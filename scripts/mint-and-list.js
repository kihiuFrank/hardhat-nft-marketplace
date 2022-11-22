const { ethers } = require("hardhat")

async function mintAndList() {
    const nftMarketplace = await ethers.getContract("NftMarketplace")
    const basicNft = await ethers.getContract("BasicNft")
    const PRICE = ethers.utils.parseEther("0.1")

    console.log("Minting...")
    const mintTx = await basicNft.mintNft()
    const mintTxReceipt = await mintTx.wait(1)
    const tokenId = mintTxReceipt.events[0].args.tokenId // from the DogMinted event

    console.log("Approving Nft...")
    const approveNft = await basicNft.approve(nftMarketplace.address, tokenId)
    await approveNft.wait(1)

    console.log("Listing Nft...")
    const tx = await nftMarketplace.listItem(basicNft.address, tokenId, PRICE)
    await tx.wait(1)
    console.log("Listed!")
}

mintAndList()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
