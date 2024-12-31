self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const action = event.action;
  
  // Post message to all clients
  self.clients.matchAll().then(function(clients) {
    clients.forEach(function(client) {
      client.postMessage({
        type: 'NOTIFICATION_ACTION',
        action: action
      });
    });
  });
});
