const wsUrl = 'wss://backend-project-5r9n.onrender.com';
let ws;
let localStream;
let peerConnections = new Map();
let roomId = null;
let isMuted = false;

const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const muteButton = document.getElementById('muteButton');
const callControls = document.getElementById('callControls');
const connectionAnimation = document.getElementById('connectionAnimation');
const roomIdDisplay = document.createElement('p');
roomIdDisplay.id = 'roomIdDisplay';
document.querySelector('.main-content').appendChild(roomIdDisplay);

// ... (keep the existing animation code)

async function getLocalStream() {
  if (!localStream) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
    } catch (error) {
      console.error('Error accessing microphone:', error);
      return null;
    }
  }
  return localStream;
}

function createPeerConnection(participantId) {
  const peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({
        type: 'ice_candidate',
        candidate: event.candidate,
        targetId: participantId
      }));
    }
  };

  peerConnection.ontrack = (event) => {
    const remoteAudio = new Audio();
    remoteAudio.srcObject = event.streams[0];
    remoteAudio.play();
  };

  if (localStream) {
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  }

  return peerConnection;
}

function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('WebSocket already connected');
    return;
  }

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connection established');
    connectButton.disabled = false;
  };

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log('Received message:', data);

    switch (data.type) {
      case 'room_created':
      case 'room_joined':
        roomId = data.roomId;
        roomIdDisplay.textContent = `Room ID: ${roomId}`;
        connectionAnimation.classList.add('hidden');
        callControls.classList.remove('hidden');
        break;
      case 'new_participant':
        const newPeerConnection = createPeerConnection(data.id);
        peerConnections.set(data.id, newPeerConnection);
        const offer = await newPeerConnection.createOffer();
        await newPeerConnection.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'offer', offer: offer, targetId: data.id }));
        break;
      case 'offer':
        const peerConnection = createPeerConnection(data.senderId);
        peerConnections.set(data.senderId, peerConnection);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: 'answer', answer: answer, targetId: data.senderId }));
        break;
      case 'answer':
        await peerConnections.get(data.senderId).setRemoteDescription(new RTCSessionDescription(data.answer));
        break;
      case 'ice_candidate':
        if (peerConnections.has(data.senderId)) {
          await peerConnections.get(data.senderId).addIceCandidate(new RTCIceCandidate(data.candidate));
        }
        break;
      case 'participant_left':
        if (peerConnections.has(data.id)) {
          peerConnections.get(data.id).close();
          peerConnections.delete(data.id);
        }
        break;
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket connection closed');
    connectButton.disabled = false;
  };
}

connectButton.addEventListener('click', async () => {
  connectButton.disabled = true;
  connectButton.classList.add('hidden');
  connectionAnimation.classList.remove('hidden');

  const stream = await getLocalStream();
  if (!stream) {
    connectionAnimation.classList.add('hidden');
    connectButton.classList.remove('hidden');
    connectButton.disabled = false;
    return;
  }

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectWebSocket();
  }

  ws.send(JSON.stringify({ type: 'create_room' }));
});

disconnectButton.addEventListener('click', () => {
  leaveRoom();
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

function leaveRoom() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'leave_room' }));
  }
  peerConnections.forEach(pc => pc.close());
  peerConnections.clear();
  roomId = null;
  roomIdDisplay.textContent = '';
  callControls.classList.add('hidden');
  connectButton.classList.remove('hidden');
  connectButton.disabled = false;
  connectionAnimation.classList.add('hidden');
  isMuted = false;
  updateMuteButtonState();
}

function keepScreenOn() {
  if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').then(lock => {
      console.log('Screen wake lock is active');
    }).catch(err => {
      console.error(`${err.name}, ${err.message}`);
    });
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && peerConnections.size > 0) {
    peerConnections.forEach(pc => pc.restartIce());
  }
});

connectWebSocket();
keepScreenOn();