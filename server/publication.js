// aggregation of live and aggregated data to be plotted with highstock
Meteor.publish('dataSeries', function(siteName, startEpoch, endEpoch) {

  var subscription = this;
  const pollData = {};
  const poll5Data = {};

  AggrData.find({ $and: [
    { site: siteName }, {
      epoch: {
        $gt: parseInt(startEpoch, 10),
        $lt: parseInt(endEpoch, 10)
      }
    }] }, { fields: { epoch: 1, subTypes: 1 } }, { sort: { epoch: 1 } }).forEach(function (test) {
      // reorganize aggregated data for plot
      const epoch = test.epoch;
      _.each(test.subTypes, function(subKey, subType) { // subType is O3, etc.
          if (!poll5Data[subType]) {
            poll5Data[subType] = {};
          }
          _.each(subKey, function(sub, key) { // sub is the array with metric/val pairs as subarrays
            if (!poll5Data[subType][key]) { // create placeholder if not exists
              poll5Data[subType][key] = [];
              poll5Data[subType][key].unit = sub[3]; // unit
            }
            if (_.last(sub).metric.indexOf('Flag') >= 0) { // get all measurements
              let datapoint = {};
              // HNET special treatment for precipitation using sum instead of avg
              if (key.indexOf('Precip') >= 0) {
                datapoint = {
                  x: epoch * 1000, // milliseconds
                  y: sub[0].val, // sum
                  color: flagsHash[_.last(sub).val].color, // the last element contains the latest flag
                  name: _.last(sub).val // will use the name of the point to hold the flag value
                };
              } else {
                datapoint = {
                  x: epoch * 1000, // milliseconds
                  y: sub[1].val, // average
                  color: flagsHash[_.last(sub).val].color, // the last element contains the latest flag
                  name: _.last(sub).val // will use the name of the point to hold the flag value
                };
              }
              poll5Data[subType][key].push(datapoint);
            }
          });
      });
    });

  for (var pubKey in poll5Data) { // pubKey equals instrument
    if (poll5Data.hasOwnProperty(pubKey)) {
      for (var key in poll5Data[pubKey]) { // key equals measurement
        // skip loop if the property is from prototype
        if (!poll5Data[pubKey].hasOwnProperty(key))
           continue;

        // create yAxis object
        let yAxis = {};
        if (pubKey.indexOf('RMY') >= 0) { // special treatment for wind instruments
          yAxis = {
            allowDecimals: false,
            labels: {
              format: '{value:.0f}'
            },
            title: {
              text: `${key}[${poll5Data[pubKey][key].unit.val}]`
            },
            opposite: false,
            floor: 0,
            ceiling: 360,
            tickInterval: 90
          };

          if (key === 'WS') {
            // HNET: there are some misreads with the sensor, and so
            // it occasionally reports wind speeds upwards of 250mph.
            yAxis.ceiling = 20;
            yAxis.tickInterval = 5;
          }
        } else if (pubKey.indexOf('49i') >= 0) {
          yAxis = {
            allowDecimals: false,
            labels: {
              format: '{value:.0f}'
            },
            title: {
              text: `${key}[${poll5Data[pubKey][key].unit.val}]`
            },
            opposite: false,
            min: 0,
            max: 250
          };
        } else if (pubKey.indexOf('Rain') >= 0) {
          // HNET setting for Rain instrument
          yAxis = {
            allowDecimals: true,
            labels: {
              format: '{value}'
            },
            title: {
              text: `${key}[${poll5Data[pubKey][key].unit.val}]`
            },
              opposite: false,
              min: 0
          };
        } else if (pubKey.indexOf('Baro') >= 0) {
          // HNET setting for Baro instrument
          yAxis = {
            allowDecimals: false,
            labels: {
              format: '{value:.0f}'
            },
            title: {
              text: `${key}[${poll5Data[pubKey][key].unit.val}]`
            },
            opposite: false,
            min: 995,
            max: 1035
          };
        } else {
          yAxis = {
            allowDecimals: false,
            labels: {
              format: '{value:.0f}'
            },
            title: {
              text: `${key}[${poll5Data[pubKey][key].unit.val}]`
            },
            opposite: false,
            min: 0
          };
        }
        subscription.added('dataSeries', `${pubKey}_${key}_5m_${poll5Data[pubKey][key][0].x}`, {
          name: key + '_5m',
          type: 'scatter',
          marker: {
            enabled: true,
            radius: 2,
            symbol: 'circle'
          },
          lineWidth: 0,
          allowPointSelect: 'true',
          data: poll5Data[pubKey][key],
          zIndex: 2,
          yAxis: yAxis
        });
      }
    }
  }

  LiveData.find({ $and: [{ site: siteName }, {
    epoch: {
      $gt: parseInt(startEpoch, 10),
      $lt: parseInt(endEpoch, 10)
    }
  }] }, { fields: { epoch: 1, subTypes: 1 } }, { sort: { epoch: 1 } }).forEach( function (test) {

    // reorganize live data for plot
    const epoch = test.epoch;
    _.each(test.subTypes, function(subKey, subType) { // subType is O3, etc.
      if (!pollData[subType]) {
        pollData[subType] = {};
      }
      _.each(subKey, function(sub) { // sub is the array with metric/val pairs as subarrays
        if (sub.metric !== 'Flag') {
          if (!pollData[subType][sub.metric]) {
            pollData[subType][sub.metric] = [];
            pollData[subType][sub.metric].unit = sub.unit; // unit
          }
          let xy = [
            epoch * 1000, // milliseconds
            sub.val
          ];
          if (isNaN(sub.val) || sub.val === '') {
            xy = [
              epoch * 1000,
              null
            ];
          }
          pollData[subType][sub.metric].push(xy);
        }
      });
    });
  });

  for (var pubKey in pollData) {
    // skip loop if the property is from prototype
    if (pollData.hasOwnProperty(pubKey)) {

      let chartType = 'line';
      let lineWidth = 1;
      let marker = {
        enabled: false
      };
      // wind data should never be shown as line
      if (pubKey.indexOf('RMY') >= 0) {
        chartType = 'scatter';
        lineWidth = 0;
        marker = {
          enabled: true,
          radius: 1,
          symbol: 'circle'
        };
      }

      for (var key in pollData[pubKey]) {
        // skip loop if the property is from prototype
        if (!pollData[pubKey].hasOwnProperty(key))
          continue;

        // create yAxis object
        let yAxis = {};
        if (pubKey.indexOf('RMY') >= 0) { // special treatment for wind instruments
          yAxis = {
            allowDecimals: false,
            labels: {
              format: '{value:.0f}'
            },
            title: {
              text: `${key}[${pollData[pubKey][key].unit}]`
            },
            opposite: false,
            floor: 0,
            ceiling: 360,
            tickInterval: 90
          };

          if (key === 'WS') {
            // NOTE: there are some misreads with the sensor, and so
            // it occasionally reports wind speeds upwards of 250mph.
            yAxis.ceiling = 20;
            yAxis.tickInterval = 5;
            yAxis.rotation = 90;
          }
        } else if (pubKey.indexOf('49i') >= 0) {
          yAxis = {
            allowDecimals: false,
            labels: {
              format: '{value:.0f} '
            },
            title: {
              text: `${key}[${pollData[pubKey][key].unit}]`
            },
            opposite: false,
            min: 0,
            max: 250
          };
        } else if (pubKey.indexOf('Rain') >= 0) {
          // HNET setting for Rain instrument
          yAxis = {
            allowDecimals: true,
            labels: {
              format: '{value}'
            },
            title: {
              text: `${key}[${pollData[pubKey][key].unit.val}]`
            },
            opposite: false,
            min: 0
          };
        } else if (pubKey.indexOf('Baro') >= 0) {
          // HNET setting for Baro instrument
          yAxis = {
            allowDecimals: false,
            labels: {
              format: '{value:.0f}'
            },
            title: {
              text: `${key}[${pollData[pubKey][key].unit.val}]`
            },
            opposite: false,
            min: 995,
            max: 1035
          };
        } else {
          yAxis = {
            allowDecimals: false,
            labels: {
              format: '{value:.0f}'
            },
            title: {
              text: `${key}[${pollData[pubKey][key].unit}]`
            },
            opposite: false,
            min: 0
          };
        }

        // add to subscription
        if (pubKey.indexOf('RMY') >= 0) { // special treatment for wind instruments
        } else {
					console.log(pubKey, key, JSON.stringify(pollData[pubKey][key][10]));
					console.log(pubKey, key, JSON.stringify(pollData[pubKey][key][11]));
					console.log(pubKey, key, JSON.stringify(pollData[pubKey][key][12]));
          subscription.added('dataSeries', `${pubKey}_${key}_10s`, {
            name: key + '_10s',
            type: chartType,
            marker: marker,
            lineWidth: lineWidth,
            allowPointSelect: 'false',
            data: pollData[pubKey][key],
            zIndex: 1,
            yAxis: yAxis
          });
        }
      }
    }
  }

  subscription.ready();
});

// aggregation of aggregated data to be plotted with highstock for composites
Meteor.publish('compositeDataSeries', function(startEpoch, endEpoch) {

  var subscription = this;
  var pollCompData = {};

  var aggCompPipe = [
    {
      $match: {
        epoch: {
          $gt: parseInt(startEpoch, 10),
          $lt: parseInt(endEpoch, 10)
        }
      }
    }, {
      $sort: {
        epoch: -1
      }
    }, {
      $group: {
        _id: '$subTypes',
        data: {
          $push: {
            site: '$site',
            epoch: '$epoch'
          }
        }
      }
    }
  ];

  AggrData.aggregate(aggCompPipe, function(err, results) {

    // create new structure for composite data series to be used for charts
    if (results.length > 0) {
      results.forEach(function(line) {
        const epoch = line.data[0].epoch;
        const site = line.data[0].site;
        _.each(line._id, function(data, instrument) { // Instrument, HPM60 etc.
          _.each(data, function(points, measurement) { // sub is the array with metric/val pairs as subarrays, measurement, WS etc.
            if (!pollCompData[measurement]) { // create placeholder for measurement
              pollCompData[measurement] = {};
            }
            if (!pollCompData[measurement][site]) { // create placeholder for series if not exists
              pollCompData[measurement][site] = [];
            }

            pollCompData[measurement]
            if (_.last(points).metric.indexOf('Flag') >= 0) { // get all measurements
              var datapoint = {
                x: epoch * 1000,
                y: points[1].val, // average
              }; // milliseconds
              pollCompData[measurement][site].push(datapoint);
            }
          });
        });
      });
    }

    for (var measurement in pollCompData) {
      if (pollCompData.hasOwnProperty(measurement)) {
        for (var site in pollCompData[measurement]) { //key equals measurement
          // skip loop if the property is from prototype
          if (!pollCompData[measurement].hasOwnProperty(site))
            continue;

          var dataSorted = pollCompData[measurement][site].sort(function(obj1, obj2) {
            // Ascending: first age less than the previous
            return obj1.x - obj2.x;
          });

          const selectedSite = LiveSites.findOne({AQSID: site});

          subscription.added('compositeDataSeries', `${measurement}_${site}_comp}`, {
            name: selectedSite.siteName,
            type: 'scatter',
            marker: {
              enabled: true,
              radius: 2,
              symbol: 'circle'
            },
            lineWidth: 0,
            data: dataSorted,
            yAxis: {
              allowDecimals: false,
              title: {
                text: unitsHash[measurement]
              },
              min: 0,
              opposite: false
            }
          });
        }
      }
    }
  }, function(error) {
    Meteor._debug('error during composite publication aggregation: ' + error);
  });
});

// edited points
Meteor.publish('aggregateEdits', function() {
  return AggrEdits.find({});
});

// pushed data time stamps
Meteor.publish('exports', function() {
  return Exports.find({
    startEpoch: {
      $type: 'int'
    }
  });
});

Meteor.publish('liveSites', function() {
  return LiveSites.find({}, {
    sort: {
      'siteName': 1
    }
  });
});

Meteor.publish('userData', function() {
  if (this.userId) {
    return Meteor.users.find({
      _id: this.userId
    }, {
      fields: {
        'other': 1,
        'things': 1
      }
    });
  } else {
    this.ready();
  }
});
