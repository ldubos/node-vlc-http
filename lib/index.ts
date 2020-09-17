import equal from 'deep-equal';
import { EventEmitter } from 'events';
import http from 'http';
import querystring from 'querystring';

export interface Information {
  chapter: number;
  chapters: number[];
  title: number;
  category: Category;
  titles: number[];
}

export interface Category {
  meta: Meta;
  [flux: string]: { [key: string]: string } | Meta;
}

export interface Flux {
  [flux: string]: string;
}

export interface Audiofilters {
  [filter: string]: string;
}

export interface Meta {
  encoded_by: string;
  filename: string;
}

export interface Videoeffects {
  hue: number;
  saturation: number;
  contrast: number;
  brightness: number;
  gamma: number;
}

type Stats = { [key: string]: number };

type AspectRatio =
  | '1:1'
  | '4:3'
  | '5:4'
  | '16:9'
  | '16:10'
  | '221:100'
  | '235:100'
  | '239:100';

type State = 'paused' | 'playing' | 'stopped';

type StatusBase = {
  fullscreen: boolean;
  stats: Stats | null;
  aspectratio: AspectRatio | null;
  audiodelay: number;
  apiversion: number;
  currentplid: number;
  time: number;
  volume: number;
  length: number;
  random: boolean;
  audiofilters: Audiofilters;
  rate: number;
  videoeffects: Videoeffects;
  state: State;
  loop: boolean;
  version: string;
  position: number;
  information: Information;
  repeat: boolean;
  subtitledelay: number;
  equalizer: any[];
};

type StatusPaused = StatusBase & {
  stats: Stats;
  aspectratio: AspectRatio;
  state: 'paused';
};

type StatusPlaying = StatusBase & {
  stats: Stats;
  aspectratio: AspectRatio;
  state: 'playing';
};

type StatusStopped = StatusBase & {
  stats: null;
  aspectratio: null;
  state: 'stopped';
};

type Status = StatusPaused | StatusPlaying | StatusStopped;

const enum CommandScope {
  BROWSE = '/requests/browse.json',
  STATUS = '/requests/status.json',
  PLAYLIST = '/requests/playlist.json'
}

type BrowseElement = {
  type: 'dir' | 'file';
  path: string;
  name: string;
  uid: number;
  creation_time: number;
  gid: number;
  modification_time: number;
  mode: number;
  uri: string;
  size: number;
};

type Browse = {
  elements: BrowseElement[];
};

type PlaylistBase = {
  ro: 'rw' | 'ro';
  type: 'node' | 'leaf';
  name: string;
  id: string;
  children?: any[];
  duration?: number;
  uri?: string;
};

type PlaylistLeaf = PlaylistBase & {
  duration: number;
  uri: string;
};

type PlaylistNode = PlaylistBase & {
  children: (PlaylistNode | PlaylistLeaf)[];
};

type Playlist = PlaylistNode | PlaylistLeaf;

export type VLCOptions = {
  host?: string;
  port?: number;
  username: string;
  password: string;
  /** update automatically status and playlist of VLC, default true. */
  autoUpdate?: boolean;
  /** how many times per seconds (in ms) node-vlc-http will update the status of VLC, default 1000/30 ~ 33ms (30fps).*/
  tickLengthMs?: number;
  /**
   * checks that browse, status and playlist have changed since the last update of one of its elements,
   * if it the case fire browsechange, statuschange or playlistchange event. default true.
   */
  changeEvents?: boolean;
};

export declare interface VLC {
  on(event: 'tick', listener: (delta: number) => void): this;
  on(event: 'update', listener: (status: Status, playlist: any) => void): this;
  on(
    event: 'statuschange',
    listener: (prev: Status, next: Status) => void
  ): this;
  on(event: 'playlistchange', listener: (prev: any, next: any) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
}

const s2nano = 1e9;
const ms2nano = 1e6;
const nano2s = 1 / s2nano;

function getNano(): number {
  const hrtime = process.hrtime();
  return +hrtime[0] * s2nano + +hrtime[1];
}

function get<T = any>(options: http.RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = http.get(options, response => {
      let data = '';

      response.on('error', reject);
      response.on('data', chunk => (data += chunk));
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
  });
}

export class VLC extends EventEmitter {
  private _host: string;
  private _port: number;
  private _autoUpdate = true;
  private _changeEvents = true;
  private _authorization: string;
  private _tickLengthMs: number;
  private _tickLengthNano: number;
  private _longWaitMs: number;
  private _longWaitNano: number;
  private _prev: number;
  private _target: number;
  private _status: Status = null as any;
  private _playlist: Playlist = null as any;

  constructor(options: VLCOptions) {
    super();

    this._host = options.host || '127.0.0.1';
    this._port = options.port || 8080;

    if (typeof options.autoUpdate === 'boolean') {
      this._autoUpdate = options.autoUpdate;
    }

    if (typeof options.changeEvents === 'boolean') {
      this._changeEvents = options.changeEvents;
    }

    this._tickLengthMs = options.tickLengthMs || 1000 / 30;

    // node leaks memory if setTimeout is called with a value less than 16
    if (this._tickLengthMs < 16) {
      this._tickLengthMs = 16;
    }

    this._tickLengthNano = this._tickLengthMs * ms2nano;
    this._longWaitMs = Math.floor(this._tickLengthMs - 1);
    this._longWaitNano = this._longWaitMs * ms2nano;
    this._prev = getNano();
    this._target = this._prev;

    // generate authorization string
    this._authorization = `Basic ${Buffer.from(
      `${options.username}:${options.password}`
    ).toString('base64')}`;

    // check if VLC is up
    this._sendCommand(CommandScope.STATUS)
      .catch(this.emit.bind(this, 'error'))
      .then(() => {
        if (this._autoUpdate) {
          // start loop
          this._doTick();
        }
      });
  }

  private _doTick(): void {
    const now = getNano();

    if (now >= this._target) {
      const delta = (now - this._prev) * nano2s;
      this._prev = now;
      this._target = now + this._tickLengthNano;

      this.emit('tick', delta);
      this.updateAll().catch(err => this.emit('error', err));
    }

    const remainingInTick = this._target - getNano();

    if (remainingInTick > this._longWaitNano) {
      setTimeout(
        this._doTick.bind(this),
        Math.max(this._longWaitMs, this._tickLengthMs)
      );
    } else {
      setImmediate(this._doTick.bind(this));
    }
  }

  private async _sendCommand<T = any>(
    scope: CommandScope,
    command?: string | null,
    options?: { [key: string]: any }
  ): Promise<T> {
    let query = null;

    if (command) {
      query = querystring.stringify({ command, ...options });
    } else if (!command && query) {
      query = querystring.stringify(options);
    }

    return get({
      host: this._host,
      port: this._port,
      path: `${scope}${query ? `?${query}` : ''}`,
      headers: {
        Authorization: this._authorization
      }
    });
  }

  public async browse(path: string): Promise<Browse> {
    const browse = this._sendCommand(CommandScope.BROWSE, null, {
      dir: path
    });

    return browse;
  }

  public async updateStatus(): Promise<Status> {
    const status = await this._sendCommand(CommandScope.STATUS);

    if (this._changeEvents && !equal(status, this._status)) {
      try {
        this.emit('statuschange', this._status || status, status);
      } catch (err) {
        this.emit('error', err);
      }
      this._status = status;
    }

    return status;
  }

  public async updatePlaylist(): Promise<Playlist> {
    const playlist = await this._sendCommand(CommandScope.PLAYLIST);

    if (this._changeEvents && !equal(playlist, this._playlist)) {
      try {
        this.emit('playlistchange', this._playlist || playlist, playlist);
      } catch (err) {
        this.emit('error', err);
      }
      this._playlist = playlist;
    }

    return playlist;
  }

  public async updateAll(): Promise<[Status, Playlist]> {
    const [status, playlist] = await Promise.all([
      this.updateStatus(),
      this.updatePlaylist()
    ]);

    try {
      this.emit('update', status, playlist);
    } catch (err) {
      this.emit('error', err);
    }

    return [status, playlist];
  }

  /**
   * Add `uri` to playlist and start playback.
   */
  public addToQueueAndPlay(
    uri: string,
    option?: 'noaudio' | 'novideo'
  ): Promise<Status> {
    const options = {
      input: uri,
      option
    };

    return this._sendCommand(CommandScope.STATUS, 'in_play', options);
  }

  /**
   * Add `uri` to playlist.
   */
  public addToQueue(uri: string): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'in_enqueue', { input: uri });
  }

  /**
   * Add subtitle to currently playing file.
   */
  public addSubtitle(uri: string): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'addsubtitle', {
      input: uri
    });
  }

  /**
   * Play playlist item `id`. If `id` is omitted, play last active item.
   */
  public play(id: number): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'pl_play', { id });
  }

  /**
   * Toggle pause. If current state was 'stop', play item `id`, if `id` is omitted, play current item.
   * If no current item, play 1st item in the playlist.
   */
  public pause(id: number): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'pl_pause', { id });
  }

  /**
   * Stop playback.
   */
  public stop(): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'pl_forcepause');
  }

  /**
   * Resume playback if state was 'paused', else do nothing.
   */
  public resume(): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'pl_forceresume');
  }

  /**
   * Pause playback, do nothing if state was 'paused'.
   */
  public forcePause(): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'pl_forcepause');
  }

  /**
   * Jump to next item in playlist.
   */
  public playlistNext(): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'pl_next');
  }

  /**
   * Jump to previous item in playlist.
   */
  public playlistPrevious(): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'pl_previous');
  }

  /**
   * Delete item `id` from playlist.
   */
  public playlistDelete(id: number): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'pl_delete', { id });
  }

  /**
   * Empty playlist.
   */
  public playlistEmpty(): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'pl_empty');
  }

  /**
   * Sort playlist using sort mode `mode` and order `order`.
   * If `order` = 0 then items will be sorted in normal order, if `order` = 1 ` they will be sorted in reverse order.
   * A non exhaustive list of sort modes:
   *  0 Id
   *  1 Name
   *  3 Author
   *  5 Random
   *  7 Track number
   */
  public sortPlaylist(order: 0 | 1, mode: 0 | 1 | 3 | 5 | 7): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'pl_sort', {
      id: mode,
      val: order
    });
  }

  /**
   * Set audio delay.
   */
  public setAudioDelay(delay: number): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'audiodelay', { val: delay });
  }

  /**
   * Set subtitle delay.
   */
  public setSubtitleDelay(delay: number): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'subdelay', { val: delay });
  }

  /**
   * Set playback rate.
   */
  public setPlaybackRate(rate: number): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'rate', { val: rate });
  }

  /**
   * Set aspect ratio.
   */
  public setAspectRatio(ratio: AspectRatio): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'aspectratio', {
      val: ratio
    });
  }

  /**
   * Set volume level to `volume`.
   */
  public setVolume(volume: number | string): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'volume', { val: volume });
  }

  /**
   * Set the preamp value.
   */
  public setPreamp(value: number): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'preamp', { val: value });
  }

  /**
   * Set the gain for a specific band.
   */
  public setEqualizer(band: number, gain: number): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'equalizer', {
      band: band,
      val: gain
    });
  }

  /**
   * Set the equalizer preset as per the `id` specified.
   */
  public setEqualizerPreset(id: number): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'equalizer', { val: id });
  }

  /**
   * Toggle random playback.
   */
  public toggleRandom(): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'pl_random');
  }

  /**
   * Toggle loop.
   */
  public toggleLoop(): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'pl_loop');
  }

  /**
   * Toggle repeat.
   */
  public toggleRepeat(): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'pl_repeat');
  }

  /**
   * Toggle fullscreen.
   */
  public toggleFullscreen(): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'fullscreen');
  }

  /**
   * Seek to `time`.
   * @return  {Promise<object>}
   */
  public seek(time: number): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'seek', { val: time });
  }

  /**
   * Seek to chapter `chapter`.
   */
  public seekToChapter(chapter: number): Promise<Status> {
    return this._sendCommand(CommandScope.STATUS, 'chapter', { val: chapter });
  }
}
