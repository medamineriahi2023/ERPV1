export const environment = {
  production: false,
  apiUrl: 'https://197.15.18.165:3000',
  firebase: {
    apiKey: "AIzaSyCCHS4bCp0vVv_XgEWg8_q5FUlgciFGywE",
    authDomain: "whatsapp-6abb0.firebaseapp.com",
    databaseURL: "https://whatsapp-6abb0-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "whatsapp-6abb0",
    storageBucket: "whatsapp-6abb0.appspot.com",
    messagingSenderId: "157350760400",
    appId: "1:157350760400:web:86fbb9e4026aad2dc7b3d5"
  },
  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: [
          'turn:turn.example.com:3478?transport=udp',
          'turn:turn.example.com:3478?transport=tcp',
          'turns:turn.example.com:5349?transport=tcp'
        ],
        username: 'YOUR_TURN_USERNAME',
        credential: 'YOUR_TURN_PASSWORD'
      }
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'relay',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    sdpSemantics: 'unified-plan'
  }
};
