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

    // Search Button Function
    const handleSubmit = (event) => {
        event.preventDefault();

        // The link must be a spotify playlist link
        if (input.includes("open.spotify.com/playlist/") && input.includes("?")) {

            // Extracting Playlist ID
            let playlistURL = input;
            let playlistSplitA = playlistURL.split('/')[4];
            let playlistSplitB = playlistSplitA.split('?');
            let playlistID = playlistSplitB[0];

            // MP3 File Download
            const playlistCall = async () => {

                // Calling the back-end (Node.js server) to call Spotify for playlist data and call YouTube for music video links
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

                    // Calling the back-end (Node.js server) to create music files to download from YouTube links
                    fetch(`${API_BASE_URL}/download`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            youtubeLinks,
                            playlist
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
                    })
                    .catch(error => console.error('Error:', error));

                } catch (error) {
                    console.log(error);
                }
            }

            playlistCall();
        }
        else {
            console.log("Be sure to input the playlist link")
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

    // Spotify Authorization Page Redirect
    const login = async () => {
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
            window.location.href = data.link;
        } catch (error) {
            console.log(error);
        }
    }

    // Display
    return (
        <div className="contain">

            {!spotifyAuth &&
                <button className='spotifyLogin' onClick={login}>Login to Spotify</button>
            }

            {spotifyAuth &&
                <div className='containForm'>
                    <h1 className='title'>Spotify Playlist MP3 Converter</h1>
                    <h1 className='description'>Turn a Spotify Playlist into MP3 Files</h1>
                    <form className='convertForm' onSubmit={handleSubmit}>
                        <label>
                            <h1 className='message'>i.e. https://open.spotify.com/playlist/...</h1>
                            <input className='inputLink' type="text" value={input} onChange={(event) => setInputValue(event.target.value)} />
                            <h1 className='message'>Note: May have to wait a bit to process</h1>
                        </label>
                        <br></br><br></br>
                        <input className='submitLink' type="submit" value="Submit" />
                    </form>
                </div>
            }

        </div>
    );
};

export default App;