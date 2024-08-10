const ws = new WebSocket('wss://backend-project-5r9n.onrender.com');

const connectButton = document.getElementById('connectButton');
const loadingIndicator = document.getElementById('loading');
const disconnectButton = document.getElementById('disconnectButton');

connectButton.addEventListener('click', () => {
  loadingIndicator.classList.remove('hidden');
  connectButton.classList.add('hidden');

  setTimeout(() => {
    loadingIndicator.classList.add('hidden');
    disconnectButton.classList.remove('hidden');
    console.log('Connected');
  }, 2000); // Simulate connection delay
});

disconnectButton.addEventListener('click', () => {
  disconnectButton.classList.add('hidden');
  connectButton.classList.remove('hidden');
  console.log('Call ended');
});
