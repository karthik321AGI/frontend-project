const wsUrl = 'wss://backend-project-5r9n.onrender.com';
let ws;
let peerConnection;
let localStream;
let isMuted = false;

const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const muteButton = document.getElementById('muteButton');
const callControls = document.getElementById('callControls');
const connectionAnimation = document.getElementById('connectionAnimation');

const animation = lottie.loadAnimation({
  container: document.getElementById('lottie-animation'),
  renderer: 'svg',
  loop: true,
  autoplay: true,
  path: 'assets/rabbit.json'
});

animation.setSpeed(1);
animation.setSubframe(false);

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

  if (localStream) {
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  }
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
      case 'connection_established':
        connectionAnimation.classList.add('hidden');
        callControls.classList.remove('hidden');
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
      case 'call_ended':
        handleCallEnded();
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

  ws.send(JSON.stringify({ type: 'request_connection' }));
});

disconnectButton.addEventListener('click', () => {
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

function handleCallEnded() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  callControls.classList.add('hidden');
  connectButton.classList.remove('hidden');
  connectButton.disabled = false;
  connectionAnimation.classList.add('hidden');

  isMuted = false;
  updateMuteButtonState();
}

function endCall() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'end_call' }));
  }
  handleCallEnded();
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
  if (!document.hidden && peerConnection) {
    peerConnection.restartIce();
  }
});

connectWebSocket();
keepScreenOn();