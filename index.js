const fs = require('fs-promise');
const path = require('path');
const AWS = require('aws-sdk');
const mimetypes = require('mime-types');

const S3 = new AWS.S3({
    region: "us-east-1"
});

const {S3_BUCKET, IO_LOCAL_PATH} = process.env;

if (IO_LOCAL_PATH) {
    
    fs.emptyDirSync(IO_LOCAL_PATH);
    
    const http = require('http');
    const static = require('node-static');

    var file = new static.Server(IO_LOCAL_PATH);

    require('http').createServer(function (request, response) {
        response.setHeader('Access-Control-Allow-Origin','*');
        request.addListener('end', function () {
            file.serve(request, response);
        }).resume();
    }).listen(5678);
    console.log("Serving local uploads on port 5678...")
} else if (!S3_BUCKET) {
    console.error("Must declare S3_BUCKET environment variable");
    process.exit(1);
}

const uploadLocal = function(pathToUpload, content) {
    let dirname = path.dirname(pathToUpload);
    return fs.mkdirs(path.join(IO_LOCAL_PATH, dirname))
    .then(() => {
        return fs.writeFile(path.join(IO_LOCAL_PATH, pathToUpload), content)
    })
}

const uploadS3 = function(pathToUpload, content) {
    let mime = mimetypes.lookup(pathToUpload)
   
    //console.log('uploading to', S3_BUCKET, pathToUpload, mime)
    return S3.putObject({
        ACL: "public-read",
        CacheControl: "no-cache",
        ContentType: mime,
        Body: content,
        Bucket: S3_BUCKET,
        Key: pathToUpload
    }).promise()
}

const downloadLocal = function(pathToDownload) {
    return fs.readFile(path.join(IO_LOCAL_PATH, pathToDownload), 'UTF-8')
    .catch((err) => {
        if (err.code === 'ENOENT'){
            return null;
        }
        throw err;
    })
}

const downloadS3 = function(pathToDownload) {
    return S3.getObject({
        Bucket: S3_BUCKET,
        Key: pathToDownload
    }).promise()
    .then((res) => {
      return res.Body.toString();
    })
    .catch((err) => {
        if (err.name === "NoSuchKey") {
            return null;
        }
        throw err;
    })
    
}

module.exports = {
    upload: function(path, content) {
        if (IO_LOCAL_PATH) {
            return uploadLocal(path, content);
        } else {
            return uploadS3(path, content);
        }
    },
    download: function(path) {
        if (IO_LOCAL_PATH) {
            return downloadLocal(path);
        } else {
            return downloadS3(path);
        }
    }
}