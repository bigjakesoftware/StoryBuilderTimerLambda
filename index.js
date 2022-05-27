const MysqlSync = require('sync-mysql')
const s3 = require('./s3')
const logger = require('./logger')
//should receive event with last refresh time and interval
var connection = new MysqlSync({
    host: 'database-2.cqv0hqs7ilvl.us-east-1.rds.amazonaws.com',
    user: 'admin',
    password: 'ShiftyBird67',
    port: '3306'
});

var interval = 3600000; //one hour


exports.handler = async (event) => {
    //update story first
    logger.info("received event: " + JSON.stringify(event))

    if (event.interval) {
        interval = event.interval
    }
    logger.info("interval: " + interval)

    var forceUpdate = false
    if (event.forceUpdate) {
        forceUpdate = event.forceUpdate
    }
    logger.info("force update: " + forceUpdate)

    connection.query('CREATE DATABASE IF NOT EXISTS main;')
    connection.query('USE main;')
    connection.query('CREATE TABLE IF NOT EXISTS timetable(refreshTime BIGINT, createDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(refreshTime));')

    //should still get most recent time first and see if we have passed the end
    //The interval that the lambda runs at should always be less than or equal to the interval it updates story at
    const result = connection.query('SELECT MAX(refreshTime) AS nextInterval FROM timetable');
    var nextTime
    logger.info("result: " + JSON.stringify(result))
    if (result.length == 1 && result[0].nextInterval !== null) {
        logger.info("length 1")
        //if were past the latest date, we need to update the story
        if (Date.now() > result[0].nextInterval || forceUpdate) {
            logger.info("Now is after interval")
            const tablename = 'words' + result[0].nextInterval
            const topWord = connection.query(`SELECT word, count(*) as num FROM ${tablename} group by word order by num desc limit 1;`)
            logger.info("Top Word: " + JSON.stringify(topWord))
            if (topWord.length == 1) {
                await s3.readStory()
                .then(async (res) => {
                    const story = (res != "" ? res + " " : res) + topWord[0].word
                    await s3.uploadStory(story, result[0].nextInterval)
                    logger.info("Story so far: " + story)
                })
            }
            nextTime = Date.now() + interval
            connection.query(`INSERT INTO timetable (refreshTime) VALUES ('${nextTime}');`)
            const newTable = 'words' + nextTime
            connection.query(`CREATE TABLE ${newTable}(id varchar(36) NOT NULL, word varchar(50) NOT NULL, createDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id));`)
            archiveOldTables(nextTime)
        } else { //we just continue to wait
            logger.info("Just waiting")
            return;
        }
    } else {
        logger.info("empty table")
        nextTime = Date.now() + interval;
        logger.info("Next time: " + nextTime)
        connection.query(`INSERT INTO timetable (refreshTime) VALUES ('${nextTime}');`)
        const newTable = 'words' + nextTime
        connection.query(`CREATE TABLE ${newTable}(id varchar(36) NOT NULL, word varchar(50) NOT NULL, createDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id));`)
    }
}


function archiveOldTables(ts) {
    
    const tables = connection.query(`show tables;`)

    logger.info("Archive tables result: " + tables.length)
    logger.info("Archive table result at 0: " + JSON.stringify(tables[0]));
    tables.forEach(elm => {
        //remove old tables
        const tablename = elm.Tables_in_main
        if (tablename.startsWith('words')) {
            const tabletimestamp = parseInt(tablename.substring(5))
            if (!isNaN(tabletimestamp) && tabletimestamp != ts) {
                //archive the table first then delete, if the table is empty just delete
                //for right now, we can just delete the old table, can worry about archiving later
                connection.query(`drop table ${tablename};`)
            }
        }
    })
}