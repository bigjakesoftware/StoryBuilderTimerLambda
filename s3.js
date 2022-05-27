const readline = require('readline');
const AWS = require('aws-sdk')
AWS.config.update({region: 'us-east-1'});
const logger = require('./logger')


const s3 = new AWS.S3({apiVersion: '2006-03-01'});

const uploadStory = async (story, timestamp) => new Promise(async (resolve, reject) => {
    console.log("uploading story")
    var uploadParams = { Bucket: "story-builder-bigjakesoftware-bucket-alpha",
                         Key: `${timestamp}.txt`,
                         Body: story };
    // call S3 to retrieve upload file to specified bucket
    const uploadTimestampPromise = new Promise((res, rej) => {
        s3.upload(uploadParams, (err, data) => {
            if (!err) {
                console.log("Success uploading timestamp story")
                res()
            } else {
                console.log("Error uploading timestamp story: " + err)
                rej(err)
            }
        })
    })
        

    uploadParams = { Bucket: "story-builder-bigjakesoftware-bucket-alpha",
                         Key: "latest.txt",
                         Body: story };
    // call S3 to retrieve upload file to specified bucket
    const uploadLatestPromise = new Promise((res, rej) => {
        s3.upload(uploadParams, (err, data) => {
            if (!err) {
                console.log("Success uploading latest story")
                res()
            } else {
                console.log("Error uploading latest story: " + err)
                rej(err)
            }
        })
    })

    await Promise.all([uploadTimestampPromise, uploadLatestPromise])
    resolve()
});

const readStory = async function () {
    var readParams = { Bucket: 'story-builder-bigjakesoftware-bucket-alpha', Key: 'latest.txt' }
    
    const rl = readline.createInterface({
        input: s3.getObject(readParams).createReadStream()
    });
    var story = ""
    try {
        for await (const line of rl) {
            // Each line in input.txt will be successively available here as `line`.
            story += line
            logger.info(`Line from file: ${line}`);
        }
        return story
    } catch (error) {
        if (error.code == "NoSuchKey") {
            logger.info("Error getting story", error)
            return ""
        } else {
            throw error
        }
    }
}

module.exports = {uploadStory, readStory}