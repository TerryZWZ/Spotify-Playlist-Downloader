const dotenv = require('dotenv').config(); // Environmental Variables
const express = require('express'); // Routing
const cors = require('cors'); // Enable CORS policy
const bodyParser = require('body-parser'); // For extracting data and have access to it
const archiver = require('archiver'); // For downloading zip files
const youtube = require('scrape-youtube'); // To Search Youtube Links
const ytdl = require('ytdl-core'); // To Download YouTube Links

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Remember to use npm run dev to launch both back-end and front-end

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
    const APIkey = process.env.YOUTUBE_API_KEY;
    let playlist = [];
    const { link, accessToken } = req.body;
    
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
                youtube.search(searchTerm).then((results) => {
                    if (results.videos.length > 0) {
                        resolve(results.videos[0].link);
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
        zlib: { level: 9 }
    });

    res.attachment('music.zip'); // Sets HTTP response and zip file name

    // If archiver encounters an error
    archive.on('error', (err) => {
        throw err;
    });

    // Archiver sends to client
    archive.pipe(res);

    // YouTube Download Settings
    const options = {
        quality: 'highest',
        filter: 'audioonly',
        format: 'mp3'
    }

    console.log("The following songs will be downloaded:")
    let downloadedSongs = 0;

    // Adding YouTube MP3 files in the zip file
    for (let i = 0; i < youtubeLinks.length; i++) {
        let file = ytdl(youtubeLinks[i], options);
        archive.append(file, { name: `${fileNames[i]}.mp3` });
        console.log(fileNames[i]);
        downloadedSongs++;
    }

    // Finalizing acrhive and logging info
    archive.finalize()
        .then(() => {
            console.log("Songs Downloaded: " + downloadedSongs);
            console.log(archive.pointer() + " total bytes");
        })
        .catch(err => {
            console.error("Archive Error: ", err);
        });
});

// Run Server [MUST BE DIFFERENT PORT FROM APP]
const PORT = process.env.PORT || 5000;
app.listen(PORT, console.log(`Server started on port ${ PORT }`));
module.exports = app;