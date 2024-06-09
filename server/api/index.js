const dotenv = require('dotenv').config(); // Environmental Variables
const express = require('express'); // Routing
const cors = require('cors'); // Enable CORS policy
const http = require('http'); // Data Transfer over HTTP
const WebSocket = require('ws'); // WebSocket server
const archiver = require('archiver'); // For downloading zip files
const ytSearch = require('yt-search'); // To Search Youtube Links
const ytdl = require("ytdl-core"); // To Download YouTube Links

const app = express();
app.use(express.json({ limit: '100gb' }));  // Set to desired limit
app.use(express.urlencoded({ limit: '100gb', extended: true }));
app.use(cors());

let downloadedSongs = 0;

/*
const server = http.createServer(app);

// WebSocket Server Setup
const wss = new WebSocket.Server({ server })

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Updating Status
const notifyProgress = () => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ downloadedSongs }));
        }
    });
};
*/

/* ----- Spotify Authentication ---- */
app.post('/login', (req, res) => {
    const clientID = process.env.SPOTIFY_CLIENT_ID;
    const { redirectURI } = req.body;
    const AUTHendpoint = 'https://accounts.spotify.com/authorize';
    const responseType = 'token';
    const authURL = `${AUTHendpoint}?client_id=${clientID}&redirect_uri=${redirectURI}&response_type=${responseType}`; // Spotify Authentication Link

    res.json({
        link: authURL
    });
});

/* ----- Spotify and Youtube Call ---- */
app.post('/playlist', async (req, res) => {
    let playlist = [];
    const { accessToken } = req.body;
    let { link } = req.body;
    
    // Retrieving Spotify playlist data and YouTube music video links
    const getPlaylist = async () => {

        // Spotify API Call for playlist data
        try {
            const response = await fetch(link, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
            });
            
            if (!response.ok) {
                throw new Error('Network Response Error');
            }

            const data = await response.json();
            let tracks = data.tracks.items;
            let promiseLinks = [];

            tracks.forEach(item => {
                playlist.push(item.track);
            });

            let nextPage = data.tracks.next;

            // Spotify Playlist Calls come in sets of 100 songs with a new URL attached to the next set
            while (nextPage) {
                const nextResponse = await fetch(nextPage, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    },
                });
                
                if (!response.ok) {
                    throw new Error('Network Response Error');
                }
    
                const nextData = await nextResponse.json();

                nextTracks = nextData.items;

                nextTracks.forEach(item => {
                    playlist.push(item.track);
                });

                nextPage = nextData.next;
            }

            console.log("Playlist Length: " + playlist.length);
        } catch (error) {
            console.log(error);
        }
    }

    await getPlaylist();

    // YouTube API Call for YouTube music video links
    function getLinks(playlist) {
        let promises = playlist.map((song) => {
            let songName = song.name;
            let artistList = song.artists.map(artist => artist.name);
            let artists = artistList.join(' ');
            let searchTerm = `${songName} by ${artists} lyrics`;

            // Return a promise for every search for each song
            return new Promise((resolve, reject) => {
                // Actual Search
                ytSearch(searchTerm).then((results) => {
                    if (results.videos.length > 0) {
                        resolve(results.videos[0].url);
                    }
                    else {
                        resolve(null);
                    }
                }).catch((err) => {
                    console.error(`Error searching for ${searchTerm}:`, err);
                    reject(err);
                });
            });
        });

        return Promise.all(promises);
    }

    // Returning Data
    try {
        let youtubeLinks = await getLinks(playlist);
        console.log("Number of Links: " + youtubeLinks.length);
        console.log(youtubeLinks);

        res.json({
            youtubeLinks: youtubeLinks,
            playlist: playlist
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'An error occurred while fetching YouTube links' });
    }
});

/* ----- MP3 File Download ---- */
app.post('/download', (req, res) => {
    console.log("Downloading...");

    // Gathering Information from React
    let youtubeLinks = req.body.youtubeLinks;
    let songInfo = req.body.playlist;
    let audioQuality = req.body.audioQuality;
    let compression = req.body.compression;

    console.log("Number of Songs: " + youtubeLinks.length);

    // If there aren't any YouTube links, there is an error
    if (!youtubeLinks) {
        return res.status(400).send({ error: 'No array was sent' });
    }

    // Creating the name of the file [Song - Artist(s)]
    let fileNames = [];

    for (let x = 0; x < songInfo.length; x++) {
        let songName = songInfo[x].name;
        let songArtists = [];

        for (let i = 0; i < songInfo[x].artists.length; i++) {
            songArtists.push(songInfo[x].artists[i].name);
        }

        let artists = songArtists.join(', ');
        let file = songName + ' - ' + artists;
        fileNames.push(file);
    }

    // Adjusting Compression Level
    const archive = archiver('zip', {
        zlib: { level: compression }
    });

    // Increasing listeners from default 10
    archive.setMaxListeners(20);

    // If archiver encounters an error
    archive.on('error', (err) => {
        throw err;
    });

    // Archiver sends to client
    archive.pipe(res);

    res.attachment('music.zip'); // Sets HTTP response and zip file name

    // YouTube Download Settings
    const options = {
        quality: audioQuality,
        format: 'mp3'
    }

    console.log("The following songs will be downloaded:")

    // Downloading Files
    async function downloadFiles(youtubeLinks, fileNames, options, archive) {
        const downloadPromises = youtubeLinks.map((link, i) => {
            return new Promise((resolve, reject) => {
                let file = ytdl(link, options);

                file.on('response', (response) => {
                    if (response.statusCode === 403) {
                        console.error('403 Forbidden for ' + (i + 1) + ' | ' + fileNames[i]);
                        return resolve();
                    }
                });

                file.on('end', () => {
                    console.log((i + 1) + ' | ' + fileNames[i]);
                    downloadedSongs++;
                    //notifyProgress();
                    resolve();
                });

                file.on('error', (err) => {
                    console.error('Download Error for ' + (i + 1) + ' | ' + fileNames[i]);
                    resolve(err);
                });

                archive.append(file, { name: `${fileNames[i]}.mp3` });
            });
        });

        await Promise.allSettled(downloadPromises);
        console.log("All download attempts completed.");
    }


    downloadFiles(youtubeLinks, fileNames, options, archive).then(() => {

        // Finalizing archive and logging info
        try {
            archive.finalize();
            console.log("Songs Downloaded: " + downloadedSongs);
            console.log(archive.pointer() + " total bytes");
        } catch (err) {
            console.error("Archive Error: ", err);
        }
    }).catch(err => {
        console.error("Unexpected Error: ", err);
        res.status(500).send({ error: 'Unexpected error occurred during the download process.' });
    });
});

// Run Server [MUST BE DIFFERENT PORT FROM APP]
const PORT = process.env.PORT || 5000;
app.listen(PORT, console.log(`Server started on port ${ PORT }`)); // Change to server.listen() for WebSocket
module.exports = app;