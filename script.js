const wsUrl = 'wss://backend-project-5r9n.onrender.com';
let ws;
let peerConnection;
let localStream;
let isMuted = false;

const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const muteButton = document.getElementById('muteButton');
const callControls = document.getElementById('callControls');
const statusDiv = document.getElementById('status');
const connectionAnimation = document.getElementById('connectionAnimation');

function setStatus(message) {
  statusDiv.textContent = message;
  statusDiv.classList.remove('hidden');
}

async function checkMicrophonePermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Error accessing microphone:', error);
    return false;
  }
}

async function setupMediaStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return true;
  } catch (error) {
    console.error('Error accessing media devices:', error);
    setStatus('Failed to access microphone');
    return false;
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
    const remoteAudio = new Audio();
    remoteAudio.srcObject = event.streams[0];
    remoteAudio.play();
  };

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
}

function connectWebSocket() {
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connection established');
  };

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log('Received message:', data);

    switch (data.type) {
      case 'connection_established':
        connectionAnimation.classList.add('hidden');
        callControls.classList.remove('hidden');
        setStatus('Call connected');
        createPeerConnection();
        if (data.initiator) {
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
      case 'waiting_for_peer':
        setStatus('Waiting for another user...');
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
  };
}

connectButton.addEventListener('click', async () => {
  connectButton.classList.add('hidden');
  connectionAnimation.classList.remove('hidden');
  setStatus('Connecting to available user...');

  const hasMicrophonePermission = await checkMicrophonePermission();
  if (!hasMicrophonePermission) {
    setStatus('Failed to access microphone');
    connectionAnimation.classList.add('hidden');
    connectButton.classList.remove('hidden');
    return;
  }

  if (!localStream) {
    const streamSetup = await setupMediaStream();
    if (!streamSetup) {
      connectionAnimation.classList.add('hidden');
      connectButton.classList.remove('hidden');
      return;
    }
  }

  if (!ws || ws.readyState === WebSocket.CLOSED) {
    connectWebSocket();
  }

  ws.send(JSON.stringify({ type: 'request_connection' }));
});

disconnectButton.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'end_call' }));
  }
  endCall();
});

muteButton.addEventListener('click', () => {
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
  updateMuteButtonState();
});

function updateMuteButtonState() {
  muteButton.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i> Unmute' : '<i class="fas fa-microphone"></i> Mute';
  muteButton.classList.toggle('muted', isMuted);
}

function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  callControls.classList.add('hidden');
  connectButton.classList.remove('hidden');
  connectionAnimation.classList.add('hidden');
  setStatus('Call ended');

  // Refresh the page after a short delay
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}

// Initial WebSocket connection
connectWebSocket();