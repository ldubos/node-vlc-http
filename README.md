# node-vlc-http

HTTP API client for vlc.

## Install:

    npm install -s node-vlc-http

or

    yarn add node-vlc-http

## Usage:

### Basics

```js
const vlc = require('node-vlc-http')(host, port, username, password)

// update browse, status and playlist at the same time
vlc.updateAll()
  .then(results => {
    const [browse, status, playlist] = results
  })
  .catch(console.error)

// update browse
vlc.updateBrowse()
  .then(browse => {
    // do stuff
  })
  .catch(console.error)

// get browse
const browse = vlc.browse

// update status
vlc.updateStatus()
  .then(browse => {
    // do stuff
  })
  .catch(console.error)

// get status
const status = vlc.status

// update playlist
vlc.updatePlaylist()
  .then(browse => {
    // do stuff
  })
  .catch(console.error)

// get playlist
const playlist = vlc.playlist
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