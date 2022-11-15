const pinataSDK = require("@pinata/sdk")
const path = require("path")
const fs = require("fs")
require("dotenv").config

// Hosting data on IPFS
// Pros: Cheap
// Cons: Someone needs to pin our data

// Hosting on chain
// Pros: The data is on chain! We don't have to worry about someone pinning our data.
// Cons: Much more expensive.
const pinataApiKey = process.env.PINATA_API_KEY
const pinataApiSecret = process.env.PINATA_API_SECRET
const pinata = pinataSDK(pinataApiKey, pinataApiSecret)

async function storeImages(imagesFilePath) {
    const fullImagespath = path.resolve(imagesFilePath)
    const files = fs.readdirSync(fullImagespath)
    let responses = []
    console.log("Uploading to Pinata!")
    for (fileIndex in files) {
        console.log(`Working on image ${fileIndex}...`)
        const readableStreamForFile = fs.createReadStream(`${fullImagespath}/${files[fileIndex]}`)
        // sending it
        try {
            const response = await pinata.pinFileToIPFS(readableStreamForFile)
            responses.push(response)
        } catch (error) {
            console.log(error)
        }
    }
    return { responses, files }
}

async function storeTokenUriMetadata(metadata) {
    try {
        const response = await pinata.pinJSONToIPFS(metadata)
        return response
    } catch (error) {
        console.log(error)
    }
    return null
}

module.exports = { storeImages, storeTokenUriMetadata }
