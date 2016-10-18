// import packages
import fs from 'fs';
import junk from 'junk';

let lastReportTime = 0;
// structure to hold current/before status information
const statusObject = {};
// list of receipients
let mailList = '';

function sendEmail(reportType, reportString) {
  const transporter = Nodemailer.createTransport();
  let mailOptions = {
    from: 'HNET Site Watcher <dashadmin@uh.edu>',
    to: mailList,
    subject: reportType,
    text: reportString
  };

  transporter.sendMail(mailOptions, function(error, info) {
    if (error) {
      logger.info('Can not send email. Error: ', error);
    } else {
      logger.info('Message sent: ', info);
    }
  });
}

// every 15 mins push data
Meteor.setInterval(() => {
  // get sites
  const activeSites = LiveSites.find({ status: 'Active' });

  activeSites.forEach(function(site) {
    const now = moment().unix();
		console.log(site.status, now - site.lastPush);
    // check last push not older than 24 hours
    if ((now - site.lastPush) < 86400) {
      const startEpoch = site.lastPush;
      const endEpoch = moment().unix();
      console.log(`called export from cron for AQSID: ${site.AQSID}, startEpoch: ${startEpoch}, endEpoch: ${endEpoch}`);
      // create TCEQ export formated data and push
      Meteor.call('pushData', site.AQSID, startEpoch, endEpoch, (err, output) => {
        if (output) {
          LiveSites.update({
            _id: site._id
          }, {
            $set: {
              lastPush: now
            }
          });
        }
      });
    }
  });
}, 1 * 30 * 1000); // run every 15 min, to push new data

// daily reset of values for reports
Meteor.setInterval(() => {
  // reset to trigger daily report
  lastReportTime = 0;

  // Find all users that have subscribed to receive status emails and update the mailList
  const listSubscribers = Meteor.users.find({receiveSiteStatusEmail: true});

  mailList = '';

  listSubscribers.forEach(function(user) {
    if (user.receiveSiteStatusEmail) {
      mailList = `${user.emails[0].address},${mailList}`;
    }
  });
}, 24 * 3600 * 1000);

// 5 mins check for site down
Meteor.setInterval(() => {
  const watchedPath = '/hnet/incoming/current/';

  // report
  let reportString = `H-NET Site Status as of ${moment().format('YYYY/MM/DD, HH:mm:ss')} \n`;

  fs.readdir(watchedPath, function(err, folders) {
    folders.filter(junk.not).forEach(function(afolder) {
      const stats = fs.statSync(watchedPath + afolder);

      const currentSiteMoment = moment(Date.parse(stats.mtime)); // from milliseconds into moments
      const timeDiff = moment() - currentSiteMoment;

      if (!statusObject[afolder]) {
        statusObject[afolder] = {};
      }

      if (timeDiff > 15 * 60 * 1000) {
        statusObject[afolder].current = `\n${afolder}: has no update since ${moment(currentSiteMoment).format('YYYY/MM/DD, HH:mm:ss')}`;
      } else {
        statusObject[afolder].current = `\n${afolder}: Operational`;
      }

      // initialize before status in first run
      if (!statusObject[afolder].before) {
        statusObject[afolder].before = statusObject[afolder].current;
      }

      // initialize sendUpdateReport
      statusObject[afolder].sendUpdateReport = false;

      // Adding info for each site to the report
      reportString = `${reportString}${statusObject[afolder].current}\n`;

      if (statusObject[afolder].current !== statusObject[afolder].before) {
        statusObject[afolder].sendUpdateReport = true;
      }

      statusObject[afolder].before = statusObject[afolder].current;
    });

    for (const site in statusObject) {
      if (statusObject.hasOwnProperty(site)) {
        if (statusObject[site].sendUpdateReport) {
          sendEmail(`${site} ${statusObject[site].current}`, reportString);
        }
      }
    }

    if (lastReportTime === 0) {
      // Daily report
      // sendEmail('Daily Report', reportString);
      logger.info(`Daily Report for ${require('os').hostname()}: ${reportString}`);
      lastReportTime = moment.unix();
    }
  });
}, 5 * 60 * 1000); // run every 5 min, to report a site is down immidiately
