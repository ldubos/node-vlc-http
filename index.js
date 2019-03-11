const http        = require('http'),
      querystring = require('querystring')

/**
 * @typedef CommandScope
 * @property {sting} Browse
 * @property {sting} Status
 * @property {sting} Playlist
 */
const CommandScope = {
  Browse:   '/requests/browse.json',
  Status:   '/requests/status.json',
  Playlist: '/requests/playlist.json'
}

class VLC {
  /**
   * @constructor
   * @param {string='127.0.0.1'}  host
   * @param {number=8080}         port
   * @param {string=''}           username
   * @param {string=''}           password
   */
  constructor(host = '127.0.0.1', port = 8080, username = '', password = '') {
    /** @private */
    this._host          = host;
    /** @private */
    this._port          = port;
    /** @private */
    this._browse        = null
    /** @private */
    this._status        = null
    /** @private */
    this._playlist      = null
    /** @private */
    this._authorization =
      'Basic' + Buffer.from(`${username}:${password}`).toString('base64');
  }

  /**
   * Send command.
   * @private
   * @param   {CommandScope}    scope
   * @param   {string=}         command
   * @param   {object=}         options
   * @return  {Promise<object>}
   */
  _command(scope, command, options) {
    return new Promise((resolve, reject) => {
      let query = null

      if (command) {
        query = querystring.stringify(Object.assign({
          command: command
        }, options || {}))
      }

      http.get({
        host: this._host,
        port: this._port,
        path: `${scope}${query ? `?${query}` : ''}`,
        headers: {
          Authorization: this._authorization
        }
      }, response => {
        let data = ''

        response.on('error', reject)

        response.on('data', chunk => data += chunk)

        response.on('end', () => {
          try {
            resolve(this[(() => {
              switch (scope) {
                case CommandScope.Browse:
                  return '_browse'
                case CommandScope.Status:
                  return '_status'
                case CommandScope.Playlist:
                  return '_playlist'
                default:
                  reject(new Error('Bad scope'))
              }
            })()] = JSON.parse(data))
          } catch (error) {
            reject(error)
          }
        })
      })
    })
  }

  /**
   * Update local `browse` value.
   * @public
   * @return {Promise<object>}
   */
  updateBrowse() {
    return this._sendCommand(CommandScopes.BROWSE)
  }

  /**
   * Update local `status` value.
   * @public
   * @return {Promise<object>}
   */
  updateStatus() {
    return this._sendCommand(CommandScopes.STATUS)
  }

  /**
   * Update local `playlist` value.
   * @public
   * @return {Promise<object>}
   */
  updatePlaylist() {
    return this._sendCommand(CommandScopes.PLAYLIST)
  }

  /**
   * @public
   * @return {Promise<Array<object>>}
   */
  updateAll() {
    return Promise.all([
      this.updateBrowse(),
      this.updateStatus(),
      this.updatePlaylist()
    ])
  }

  /**
   * Add `uri` to playlist and start playback.
   * @public
   * @param   {string}                    uri
   * @param   {("noaudio"|"novideo")=}    option
   * @return  {Promise<object>}
   */
  addToQueueAndPlay(uri, option) {
    let options = {
      input: uri
    }

    if (option)
      options.option = option

    return this._sendCommand(CommandScopes.STATUS, 'in_play', options)
  }

  /**
   * Add `uri` to playlist.
   * @public
   * @param   {string}            uri
   * @return  {Promise<object>}
   */
  addToQueue(uri) {
    return this._sendCommand(CommandScopes.STATUS, 'in_enqueue', { input: uri })
  }

  /**
   * Add subtitle to currently playing file.
   * @public
   * @param   {string}            uri
   * @return  {Promise<object>}
   */
  addSubtitle(uri) {
    return this._sendCommand(CommandScopes.STATUS, 'addsubtitle', { input: uri })
  }

  /**
   * Play playlist item `id`. If `id` is omitted, play last active item.
   * @public
   * @param   {number=}           id
   * @return  {Promise<object>}
   */
  play(id) {
    return this._sendCommand(CommandScopes.STATUS, 'pl_play', { id })
  }

  /**
   * Toggle pause. If current state was 'stop', play item `id`, if `id` is omitted, play current item.
   * If no current item, play 1st item in the playlist.
   * @public
   * @param   {number=}           id
   * @return  {Promise<object>}
   */
  pause(id) {
    return this._sendCommand(CommandScopes.STATUS, 'pl_pause', { id })
  }

  /**
   * Stop playback.
   * @public
   * @return {Promise<object>}
   */
  stop() {
    return this._sendCommand(CommandScopes.STATUS, 'pl_forcepause')
  }

  /**
   * Resume playback if state was 'paused', else do nothing.
   * @public
   * @return {Promise<object>}
   */
  resume() {
    return this._sendCommand(CommandScopes.STATUS, 'pl_forceresume')
  }

  /**
   * Pause playback, do nothing if state was 'paused'.
   * @public
   * @return {Promise<object>}
   */
  forcePause() {
    return this._sendCommand(CommandScopes.STATUS, 'pl_forcepause')
  }

  /**
   * Jump to next item in playlist.
   * @public
   * @return {Promise<object>}
   */
  playlistNext() {
    return this._sendCommand(CommandScopes.STATUS, 'pl_next')
  }

  /**
   * Jump to previous item in playlist.
   * @public
   * @return {Promise<object>}
   */
  playlistPrevious() {
    return this._sendCommand(CommandScopes.STATUS, 'pl_previous')
  }

  /**
   * Delete item `id` from playlist.
   * @public
   * @param   {number}            id
   * @return  {Promise<object>}
   */
  playlistDelete(id) {
    return this._sendCommand(CommandScopes.STATUS, 'pl_delete', { id })
  }

  /**
   * Empty playlist.
   * @public
   * @return {Promise<object>}
   */
  playlistEmpty() {
    return this._sendCommand(CommandScopes.STATUS, 'pl_empty')
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
   * @public
   * @param   {(0|1)}             order
   * @param   {(0|1|3|5|7)}       mode
   * @return  {Promise<object>}
   */
  sortPlaylist(order, mode) {
    return this._sendCommand(CommandScopes.STATUS, 'pl_sort', {
      id: mode,
      val: order
    })
  }

  /**
   * Set audio delay.
   * @public
   * @param   {number}            delay delay in seconds
   * @return  {Promise<object>}
   */
  setAudioDelay(delay) {
    return this._sendCommand(CommandScopes.STATUS, 'audiodelay', { val: delay })
  }

  /**
   * Set subtitle delay.
   * @public
   * @param   {number}            delay delay in seconds
   * @return  {Promise<object>}
   */
  setSubtitleDelay(delay) {
    return this._sendCommand(CommandScopes.STATUS, 'subdelay', { val: delay })
  }

  /**
   * Set playback rate.
   * @public
   * @param   {number}            rate must be > 0
   * @return  {Promise<object>}
   */
  setPlaybackRate(rate) {
    return this._sendCommand(CommandScopes.STATUS, 'rate', { val: rate })
  }

  /**
   * Set aspect ratio.
   * @public
   * @param   {("1:1"|"4:3"|"5:4"|"16:9"|"16:10"|"221:100"|"235:100"|"239:100")} ratio
   * @return  {Promise<object>}
   */
  setAspectRatio(ratio) {
    return this._sendCommand(CommandScopes.STATUS, 'aspectratio', { val: ratio })
  }

  /**
   * Set volume level to `volume`.
   * @public
   * @param   {number|string}     volume +<int>, -<int>, <int> or <int>%
   * @return  {Promise<object>}
   */
  setVolume(volume) {
    return this._sendCommand(CommandScopes.STATUS, 'volume', { val: volume })
  }

  /**
   * Set the preamp value.
   * @public
   * @param   {number}            value must be >=-20 and <=20
   * @return  {Promise<object>}
   */
  setPreamp(value) {
    return this._sendCommand(CommandScopes.STATUS, 'preamp', { val: value })
  }

  /**
   * Set the gain for a specific band.
   * @public
   * @param   {number}            band
   * @param   {number}            gain must be >=-20 and <=20
   * @return  {Promise<object>}
   */
  setEqualizer(band, gain) {
    return this._sendCommand(CommandScopes.STATUS, 'equalizer', { band: band, val: gain })
  }

  /**
   * Set the equalizer preset as per the `id` specified.
   * @public
   * @param   {number}            id
   * @return  {Promise<object>}
   */
  setEqualizerPreset(id) {
    return this._sendCommand(CommandScopes.STATUS, 'equalizer', { val: id })
  }

  /**
   * Toggle random playback.
   * @public
   * @return {Promise<object>}
   */
  toggleRandom() {
    return this._sendCommand(CommandScopes.STATUS, 'pl_random')
  }

  /**
   * Toggle loop.
   * @public
   * @return {Promise<object>}
   */
  toggleLoop() {
    return this._sendCommand(CommandScopes.STATUS, 'pl_loop')
  }

  /**
   * Toggle repeat.
   * @public
   * @return {Promise<object>}
   */
  toggleRepeat() {
    return this._sendCommand(CommandScopes.STATUS, 'pl_repeat')
  }

  /**
   * Toggle fullscreen.
   * @public
   * @return {Promise<object>}
   */
  toggleFullscreen() {
    return this._sendCommand(CommandScopes.STATUS, 'fullscreen')
  }

  /**
   * Seek to `time`.
   * @public
   * @param   {number|string}     time    Allowed values are of the form [+ or -][<int><H or h>:][<int><M or m or '>:][<int><nothing or S or s or ">] or
   *                                      [+ or -]<int>%
   * @return  {Promise<object>}
   */
  seek(time) {
    return this._sendCommand(CommandScopes.STATUS, 'seek', { val: time })
  }

  /**
   * Seek to chapter `chapter`.
   * @public
   * @param   {number}            chapter
   * @return  {Promise<object>}
   */
  seekToChapter(chapter) {
    return this._sendCommand(CommandScopes.STATUS, 'chapter', { val: chapter })
  }

  /**
   * @public
   * @return {object|null}
   */
  get browse() {
    return this._browse
  }

  /**
   * @public
   * @return {object|null}
   */
  get status() {
    return this._status
  }

  /**
   * @public
   * @return {object|null}
   */
  get playlist() {
    return this._playlist
  }
}

module.exports = VLC;
