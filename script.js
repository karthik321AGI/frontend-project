const wsUrl = 'wss://backend-project-5r9n.onrender.com';
let ws;
let localStream;
let peerConnections = new Map();
let roomId = null;
let isMuted = false;

const createRoomButton = document.getElementById('createRoomButton');
const joinRoomButton = document.getElementById('joinRoomButton');
const roomIdInput = document.getElementById('roomIdInput');
const disconnectButton = document.getElementById('disconnectButton');
const muteButton = document.getElementById('muteButton');
const callControls = document.getElementById('callControls');
const connectionAnimation = document.getElementById('connectionAnimation');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const participantsCount = document.getElementById('participantsCount');
const roomControls = document.getElementById('roomControls');

async function getLocalStream() {
  if (!localStream) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      console.log('Local stream obtained');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Error accessing microphone. Please ensure you have given permission.');
      return null;
    }
  }
  return localStream;
}

function createPeerConnection(participantId) {
  console.log('Creating peer connection for participant:', participantId);
  const peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ]
  });

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('Sending ICE candidate');
      ws.send(JSON.stringify({
        type: 'ice_candidate',
        candidate: event.candidate,
        targetId: participantId
      }));
    }
  };

  peerConnection.ontrack = (event) => {
    console.log('Received remote track');
    const remoteAudio = new Audio();
    remoteAudio.srcObject = event.streams[0];
    remoteAudio.play().catch(e => console.error('Error playing audio:', e));
  };

  if (localStream) {
    console.log('Adding local stream to peer connection');
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  }

  return peerConnection;
}

function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('WebSocket already connected');
    return;
  }

  console.log('Connecting to WebSocket');
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connection established');
    createRoomButton.disabled = false;
    joinRoomButton.disabled = false;
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
        roomControls.classList.add('hidden');
        updateParticipantsCount(data.participants);
        break;
      case 'new_participant':
        console.log('New participant joined:', data.id);
        const newPeerConnection = createPeerConnection(data.id);
        peerConnections.set(data.id, newPeerConnection);
        const offer = await newPeerConnection.createOffer();
        await newPeerConnection.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'offer', offer: offer, targetId: data.id }));
        updateParticipantsCount(data.participants);
        break;
      case 'offer':
        console.log('Received offer from:', data.senderId);
        const peerConnection = createPeerConnection(data.senderId);
        peerConnections.set(data.senderId, peerConnection);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: 'answer', answer: answer, targetId: data.senderId }));
        break;
      case 'answer':
        console.log('Received answer from:', data.senderId);
        await peerConnections.get(data.senderId).setRemoteDescription(new RTCSessionDescription(data.answer));
        break;
      case 'ice_candidate':
        console.log('Received ICE candidate from:', data.senderId);
        if (peerConnections.has(data.senderId)) {
          await peerConnections.get(data.senderId).addIceCandidate(new RTCIceCandidate(data.candidate));
        }
        break;
      case 'participant_left':
        console.log('Participant left:', data.id);
        if (peerConnections.has(data.id)) {
          peerConnections.get(data.id).close();
          peerConnections.delete(data.id);
        }
        updateParticipantsCount(data.participants);
        break;
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    alert('Error connecting to the server. Please try again.');
  };

  ws.onclose = () => {
    console.log('WebSocket connection closed');
    createRoomButton.disabled = false;
    joinRoomButton.disabled = false;
  };
}

createRoomButton.addEventListener('click', async () => {
  console.log('Create Room button clicked');
  await initializeCall('create_room');
});

joinRoomButton.addEventListener('click', async () => {
  console.log('Join Room button clicked');
  const roomIdToJoin = roomIdInput.value.trim();
  if (!roomIdToJoin) {
    alert('Please enter a Room ID');
    return;
  }
  await initializeCall('join_room', roomIdToJoin);
});

async function initializeCall(action, roomIdToJoin = null) {
  createRoomButton.disabled = true;
  joinRoomButton.disabled = true;
  connectionAnimation.classList.remove('hidden');

  const stream = await getLocalStream();
  if (!stream) {
    connectionAnimation.classList.add('hidden');
    createRoomButton.disabled = false;
    joinRoomButton.disabled = false;
    return;
  }

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectWebSocket();
  }

  // Ensure WebSocket is open before sending message
  if (ws.readyState === WebSocket.CONNECTING) {
    await new Promise(resolve => {
      const checkReady = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          clearInterval(checkReady);
          resolve();
        }
      }, 100);
    });
  }

  console.log(`Sending ${action} request`);
  if (action === 'create_room') {
    ws.send(JSON.stringify({ type: 'create_room' }));
  } else if (action === 'join_room') {
    ws.send(JSON.stringify({ type: 'join_room', roomId: roomIdToJoin }));
  }
}

disconnectButton.addEventListener('click', () => {
  console.log('Disconnect button clicked');
  leaveRoom();
});

muteButton.addEventListener('click', () => {
  console.log('Mute button clicked');
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
  updateMuteButtonState();
});

function updateMuteButtonState() {
  muteButton.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i> Unmute' : '<i class="fas fa-microphone"></i> Mute';
  muteButton.classList.toggle('muted', isMuted);
}

function leaveRoom() {
  console.log('Leaving room');
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'leave_room' }));
  }
  peerConnections.forEach(pc => pc.close());
  peerConnections.clear();
  roomId = null;
  roomIdDisplay.textContent = '';
  participantsCount.textContent = '';
  callControls.classList.add('hidden');
  roomControls.classList.remove('hidden');
  createRoomButton.disabled = false;
  joinRoomButton.disabled = false;
  connectionAnimation.classList.add('hidden');
  isMuted = false;
  updateMuteButtonState();
}

function updateParticipantsCount(count) {
  participantsCount.textContent = `Participants: ${count}`;
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
    peerConnections.forEach(pc => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    });
  }
});

console.log('Initializing WebSocket connection');
connectWebSocket();
keepScreenOn();