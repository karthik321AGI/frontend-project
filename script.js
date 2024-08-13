const wsUrl = 'wss://backend-project-5r9n.onrender.com';
let ws;

const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const loadingIndicator = document.getElementById('loading');
const statusDiv = document.getElementById('status');

function setStatus(message) {
  statusDiv.textContent = message;
  statusDiv.classList.remove('hidden');
}

function connectWebSocket() {
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connection established');
    setStatus('WebSocket connected');
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Received message:', data);

    if (data.type === 'speaker_connected') {
      loadingIndicator.classList.add('hidden');
      disconnectButton.classList.remove('hidden');
      setStatus('Connected to a speaker');
    } else if (data.type === 'waiting_for_speaker') {
      setStatus('Waiting for an available speaker...');
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    setStatus('Error: Could not connect to the server');
  };

  ws.onclose = () => {
    console.log('WebSocket connection closed');
    setStatus('Disconnected from server');
    connectButton.classList.remove('hidden');
    disconnectButton.classList.add('hidden');
    loadingIndicator.classList.add('hidden');
  };
}

connectButton.addEventListener('click', () => {
  loadingIndicator.classList.remove('hidden');
  connectButton.classList.add('hidden');
  statusDiv.classList.add('hidden');

  if (!ws || ws.readyState === WebSocket.CLOSED) {
    connectWebSocket();
  }

  ws.send(JSON.stringify({ type: 'request_speaker' }));
});

disconnectButton.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'end_call' }));
  }
  disconnectButton.classList.add('hidden');
  connectButton.classList.remove('hidden');
  setStatus('Call ended');
});

// Initial connection
connectWebSocket();