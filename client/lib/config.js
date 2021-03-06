Accounts.config({forbidClientAccountCreation: false});

Accounts.ui.config({
  passwordSignupFields: 'EMAIL_ONLY',
  extraSignupFields: [
    {
      fieldName: 'first-name',
      fieldLabel: 'First name',
      inputType: 'text',
      visible: true,
      validate: function(value, errorFunction) {
        if (!value) {
          errorFunction('Please write your first name');
          return false;
        } else {
          return true;
        }
      }
    }, {
      fieldName: 'last-name',
      fieldLabel: 'Last name',
      inputType: 'text',
      visible: true
    }
  ]
});

AdminDashboard.addCollectionItem(function(collection, path) {
  if (collection === 'LiveSites') {
    return {
      title: 'Troubleshoot',
      url: path + '/fixSites'
    };
  }
});

AdminDashboard.addSidebarItem('Version', AdminDashboard.path('versionInfo'), { icon: 'info' });

sAlert.config({
  effect: '',
  position: 'top-right',
  timeout: 5000,
  html: false,
  onRouteClose: true,
  stack: true,
  // or you can pass an object:
  // stack: {
  //     spacing: 10 // in px
  //     limit: 3 // when fourth alert appears all previous ones are cleared
  // }
  offset: 50, // in px - will be added to first alert (bottom or top - depends of the position in config)
  beep: false,
  // examples:
  // beep: '/beep.mp3'  // or you can pass an object:
  // beep: {
  //     info: '/beep-info.mp3',
  //     error: '/beep-error.mp3',
  //     success: '/beep-success.mp3',
  //     warning: '/beep-warning.mp3'
  // }
  onClose: _.noop, //
  // examples:
  // onClose: function() {
  //     /* Code here will be executed once the alert closes. */
  // }
});
