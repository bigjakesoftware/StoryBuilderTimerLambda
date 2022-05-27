var winston = require('winston'),
    WinstonCloudWatch = require('winston-cloudwatch');

var NODE_ENV = process.env.NODE_ENV
if (!NODE_ENV || NODE_ENV === 'development') {
    winston.add(new winston.transports.Console())
} else {
    winston.add(new WinstonCloudWatch({
        logGroupName: 'my-log-group',
        logStreamName: 'first',
        awsRegion: 'us-east-1'
    }));
}

module.exports = winston