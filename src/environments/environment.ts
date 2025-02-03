export const environment = {
  production: false,
  apiUrl: 'https://erpbackend.duckdns.org:3000',
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
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:standard.relay.metered.ca:80",
        username: "792b7484640b2867935852e4",
        credential: "yjXN2HcYE6E5eXUy",
      },
      {
        urls: "turn:standard.relay.metered.ca:80?transport=tcp",
        username: "792b7484640b2867935852e4",
        credential: "yjXN2HcYE6E5eXUy",
      },
      {
        urls: "turn:standard.relay.metered.ca:443",
        username: "792b7484640b2867935852e4",
        credential: "yjXN2HcYE6E5eXUy",
      },
      {
        urls: "turns:standard.relay.metered.ca:443?transport=tcp",
        username: "792b7484640b2867935852e4",
        credential: "yjXN2HcYE6E5eXUy",
      },
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'relay',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    sdpSemantics: 'unified-plan'
  }
};
