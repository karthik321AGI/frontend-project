const wsUrl = 'wss://backend-project-5r9n.onrender.com';
let ws;
let peerConnection;
let localStream;
let remoteStream;
let isSpeakerActive = false;

const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const speakerButton = document.getElementById('speakerButton');
const loadingIndicator = document.getElementById('loading');
const statusDiv = document.getElementById('status');
const callControls = document.getElementById('callControls');

function setStatus(message) {
  statusDiv.textContent = message;
  statusDiv.classList.remove('hidden');
}

async function setupMediaStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setStatus('Microphone access granted');
  } catch (error) {
    console.error('Error accessing media devices:', error);
    setStatus('Failed to access microphone');
  }
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: 'ice_candidate', candidate: event.candidate }));
    }
  };

  peerConnection.ontrack = (event) => {
    remoteStream = event.streams[0];
    const remoteAudio = new Audio();
    remoteAudio.srcObject = remoteStream;
    remoteAudio.play();
    updateSpeakerMode();
  };

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
}

function updateSpeakerMode() {
  if (remoteStream) {
    remoteStream.getAudioTracks().forEach(track => {
      if ('setSinkId' in track) {
        track.setSinkId(isSpeakerActive ? 'speaker' : 'default')
          .then(() => console.log(`Audio output device ${isSpeakerActive ? 'set to speaker' : 'reset to default'}`))
          .catch(error => console.error('Error setting audio output device:', error));
      }
    });
  }
}

async function connectWebSocket() {
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connection established');
    setStatus('WebSocket connected');
  };

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log('Received message:', data);

    switch (data.type) {
      case 'speaker_connected':
      case 'client_connected':
        loadingIndicator.classList.add('hidden');
        callControls.classList.remove('hidden');
        setStatus(data.type === 'speaker_connected' ? 'Connected to a speaker' : 'Connected to a client');
        createPeerConnection();
        if (data.type === 'speaker_connected') {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: 'offer', offer: offer }));
        }
        break;
      case 'offer':
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: 'answer', answer: answer }));
        break;
      case 'answer':
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        break;
      case 'ice_candidate':
        if (peerConnection) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
        break;
      case 'waiting_for_speaker':
        setStatus('Waiting for an available speaker...');
        break;
      case 'call_ended':
        endCall();
        break;
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    setStatus('Error: Could not connect to the server');
  };

  ws.onclose = () => {
    console.log('WebSocket connection closed');
    setStatus('Disconnected from server');
    endCall();
  };
}

connectButton.addEventListener('click', async () => {
  loadingIndicator.classList.remove('hidden');
  connectButton.classList.add('hidden');
  statusDiv.classList.add('hidden');

  await setupMediaStream();

  if (!ws || ws.readyState === WebSocket.CLOSED) {
    connectWebSocket();
  }

  const isSpeaker = Math.random() < 0.5;
  ws.send(JSON.stringify({ type: isSpeaker ? 'available_as_speaker' : 'request_speaker' }));
  setStatus(isSpeaker ? 'Available as a speaker' : 'Requesting a speaker');
});

function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
    remoteStream = null;
  }
  callControls.classList.add('hidden');
  connectButton.classList.remove('hidden');
  setStatus('Call ended');
}

disconnectButton.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'end_call' }));
  }
  endCall();
});

speakerButton.addEventListener('click', () => {
  isSpeakerActive = !isSpeakerActive;
  speakerButton.classList.toggle('active', isSpeakerActive);
  updateSpeakerMode();
  setStatus(`Speaker mode ${isSpeakerActive ? 'activated' : 'deactivated'}`);
});

// Initial connection
connectWebSocket();