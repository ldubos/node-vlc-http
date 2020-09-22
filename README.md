# node-vlc-http

HTTP API client for vlc.

## Install:

    npm install -s node-vlc-http

or

    yarn add node-vlc-http

## Usage:

### Basics

```js
const { VLC } = require('node-vlc-http');

const vlc = new VLC({
  host,
  port,
  username,
  password,
  // update automatically status and playlist of VLC, default true.
  autoUpdate,
  // how many times per seconds (in ms) node-vlc-http will update the status of VLC, default 1000/30 ~ 33ms (30fps)
  tickLengthMs,
  // checks that browse, status and playlist have changed since the last update of one of its elements,
  // if it the case fire browsechange, statuschange or playlistchange event. default true.
  changeEvents,
  // max tries at the first connection before throwing an error set it to -1 for infinite try, default -1
  maxTries,
  // interval between each try in ms, default 1000
  triesInterval
});

// update status and playlist at the same time
vlc.updateAll()
  .then(results => {
    const [status, playlist] = results
  })
  .catch(console.error)

vlc.browse(path)
  .then(browse => {
    // do stuff
  })
  .catch(console.error)

// update status
vlc.updateStatus()
  .then(status => {
    // do stuff
  })
  .catch(console.error)

// update playlist
vlc.updatePlaylist()
  .then(playlist => {
    // do stuff
  })
  .catch(console.error)
```

### Events

```js
vlc.on('tick', (delta) => {
  // do stuff
});

vlc.on('update', (status, playlist) => {
  // do stuff
});

vlc.on(
  'statuschange',
  (prev, next) => {
    // do stuff
  }
);

vlc.on(
  'playlistchange',
  (prev, next) => {
    // do stuff
  }
);

vlc.on('error', (err: Error) => {
  // do stuff
});

vlc.on('connect', () => {
  // do stuff
})
```

### Actions

```js
// Add media to playlist
vlc.addToQueue(uri)

// Add media to playlist and play
vlc.addToQueueAndPlay(uri)

// Add media to playlist and play without audio
vlc.addToQueueAndPlay(uri, 'noaudio')

// Add media to playlist and play without video
vlc.addToQueueAndPlay(uri, 'novideo')

// Add subtitle to currently playing file
vlc.addSubtitle(uri)

// Play video (id)
vlc.play(id)

// Pause video (id)
vlc.pause(id)

// Stop playback
vlc.stop()

// Resume playback
vlc.resume()

// Pause playback, do nothing if state was 'paused'
vlc.forcePause()

// Jump to next item in playlist
vlc.playlistNext()

// Jump to previous item in playlist
vlc.playlistPrevious()

// Delete item (id) from playlist
vlc.playlistDelete(id)

// Empty playlist
vlc.playlistEmpty()

// Sort playlist using sort mode and order
// order 0 sort by asc and 1 sort by dsc
// mode 0 sort by id, 1 sort by name, 3 sort by author, 5 sort by random and
// 7 by track number
vlc.sortPlaylist(order, mode)

// Toggle random playback
vlc.toggleRandom()

// Toggle loop
vlc.toggleLoop()

// Toggle repeat
vlc.toggleRepeat()

// Toggle fullscreen
vlc.toggleFullscreen()

// Seek to time
vlc.seek(time)

// Seek to chapter
vlc.seekToChapter(chapter)
```

## License:

MIT