const ws = new WebSocket('wss://backend-project-5r9n.onrender.com');

const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const loadingIndicator = document.getElementById('loading');

connectButton.addEventListener('click', () => {
  loadingIndicator.classList.remove('hidden');
  connectButton.classList.add('hidden');

  ws.send(JSON.stringify({ type: 'request_speaker' }));
});

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'speaker_connected') {
    loadingIndicator.classList.add('hidden');
    disconnectButton.classList.remove('hidden');
    console.log('Connected to a speaker');
  }
};

disconnectButton.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'end_call' }));
  disconnectButton.classList.add('hidden');
  connectButton.classList.remove('hidden');
  console.log('Call ended');
});
