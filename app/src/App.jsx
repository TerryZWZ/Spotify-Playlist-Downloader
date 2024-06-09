import React, { useState, useEffect } from 'react';
import Spotify from 'spotify-web-api-node';
import './App.css'

// Access Token Retrieval from URL
function getToken(hash) {
    let hashes = hash.split('&');
    let accessToken = hashes[0].replace('#access_token=', '');
    return accessToken;
}

function App() {
    const API_BASE_URL = import.meta.env.VITE_REACT_APP_BACKEND_URL; // Website URL
    let accessToken = getToken(window.location.hash); // Retrieves Access Token
    let [input, setInputValue] = useState(''); // For Spotify Playlist Input
    const [isBuffering, setIsBuffering] = useState(false); // For loading signal
    const [isAuthorizing, setIsAuthorizing] = useState(false); // For loading signal
    const [audioQuality, setAudioQuality] = useState('highestaudio');
    const [compression, setCompression] = useState(0);

    // Search Button Function
    const handleSubmit = (event) => {
        event.preventDefault();
        setIsBuffering(true);
        //setDownloadedSongs(0);

        // The link must be a spotify playlist link
        if (input.includes("open.spotify.com/playlist/") && input.includes("?")) {

            // Extracting Playlist ID
            let playlistURL = input;
            let playlistSplitA = playlistURL.split('/')[4];
            let playlistSplitB = playlistSplitA.split('?');
            let playlistID = playlistSplitB[0];

            // MP3 File Download
            const playlistCall = async () => {

                // Fetching the back-end (Node.js server) to call Spotify for playlist data and call YouTube for music video links
                try {
                    const response = await fetch(`${API_BASE_URL}/playlist`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify ({
                            link: `https://api.spotify.com/v1/playlists/${playlistID}`,
                            accessToken: accessToken
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error('Network Response Error');
                    }
    
                    const data = await response.json();
                    let youtubeLinks = data.youtubeLinks;
                    let playlist = data.playlist;

                    // Fetching the back-end (Node.js server) to create music files to download from YouTube links
                    fetch(`${API_BASE_URL}/download`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            youtubeLinks,
                            playlist,
                            audioQuality,
                            compression
                        })
                    })
                    .then(res => res.blob())
                    .then(blob => {
                        
                        // Prompting user to download compressed file with MP3 files
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', 'music.zip');
                        document.body.appendChild(link);
                        link.click();
                        setIsBuffering(false);
                    })
                    .catch(error => console.error('Error:', error));

                } catch (error) {
                    console.log(error);
                }
            }

            playlistCall();
        }
        else {
            console.log("Be sure to input the playlist link");
            setIsBuffering(false);
        } 
    };

    // Spotify Authorization Check
    let [spotifyAuth, authSpotify] = useState(false);
    const spotifyAPI = new Spotify();
    spotifyAPI.setAccessToken(accessToken);

    if (accessToken != '') {
        spotifyAPI.getMe().then(
            (response) => {
                authSpotify(true);
            },
            (error) => {
                
            }
        );
    }
/*
    // Tracking Song Downloads
    const [downloadedSongs, setDownloadedSongs] = useState(0);

    const wsURL = `ws://${API_BASE_URL.replace(/^https?:\/\//, '')}`; 
    useEffect(() => {
        const ws = new WebSocket(wsURL);

        ws.onopen = () => {
            console.log('Connected to WebSocket server');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setDownloadedSongs(data.downloadedSongs);
            console.log(data.downloadedSongs)
        };

        ws.onclose = () => {
            console.log('Disconnected from WebSocket server');
        };

        return () => {
            ws.close();
        };
    }, []);
*/
    // Spotify Authorization Page Redirect
    const login = async () => {
        setIsAuthorizing(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify ({
                    redirectURI: window.location.protocol + '//' + window.location.host + '/callback'
                })
            });
            
            if (!response.ok) {
                throw new Error('Network Response Error');
            }

            const data = await response.json();
            setIsAuthorizing(false);
            window.location.href = data.link;
        } catch (error) {
            console.log(error);
        }
    }

    // Display
    return (
        <div className="contain">

            {!spotifyAuth &&
                <div className='loginForm'>
                    <button className='spotifyLogin' onClick={login}>Login to Spotify</button>
                    <h1 className='message'>Note: May need to wait a minute or two for the backend to wake up</h1>

                    {isAuthorizing &&
                        <div className='buffering'>
                            <span className='dot'>.</span><span className='dot'>.</span><span className='dot'>.</span>
                        </div>
                    }
                </div>
            }

            {spotifyAuth &&
                <div className='containForm'>
                    <h1 className='title'>Spotify Playlist MP3 Converter</h1>
                    <h1 className='description'>Turn a Spotify Playlist into MP3 Files</h1>
                    
                    <form className='convertForm' onSubmit={handleSubmit}>
                        <label>
                            <h1 className='message'>i.e. https://open.spotify.com/playlist/...</h1>
                            <input className='inputLink' type="text" value={input} onChange={(event) => setInputValue(event.target.value)} />
                            
                            <h1 className='message'>Note: Processing time depends on size of playlist, audio quality, and compression level, larger values take longer</h1>
                        </label>

                        {/* <h1 className='songInfo'>Songs Downloaded: {downloadedSongs} </h1> */}
                        
                        <div className="bottomContain">
                            <div className='optionsContain'>
                                <div className='selection'>
                                    <label className='options' htmlFor="audioQuality">Audio Quality:</label>
                                    <select className="audioQuality" value={audioQuality} onChange={(e) => setAudioQuality(e.target.value)}>
                                        <option value="highestaudio">Best Quality</option>
                                        <option value="lowestaudio">Storage Saver</option>
                                    </select>
                                </div>
                                <div className='selection'>
                                    <label className='options' htmlFor="compression">Compression:</label>
                                    <select className="compression" value={compression} onChange={(e) => setCompression(parseInt(e.target.value))}>
                                        {Array.from({ length: 10 }, (_, i) => (
                                            <option key={i} value={i}>{i}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <input className='submitLink' type="submit" value="Submit" />
                        </div>
                    </form>
                </div>
            }

            {isBuffering &&
                <div className='buffering'>
                    <span className='dot'>.</span><span className='dot'>.</span><span className='dot'>.</span>
                </div>
            }

        </div>
    );
};

export default App;