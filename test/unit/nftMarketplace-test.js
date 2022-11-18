const { assert, expect } = require("chai")
const { network, ethers, deployments } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft Marketplace Unit Tests", () => {
          let deployer, accounts, nftMarketplace, basicNft
          const TOKEN_ID = 0
          const PRICE = ethers.utils.parseEther("0.1")
          beforeEach("Runs before every test", async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              player = accounts[1]

              await deployments.fixture(["all"])
              nftMarketplace = await ethers.getContract("NftMarketplace")
              basicNft = await ethers.getContract("BasicNft")
              await basicNft.mintNft()
              await basicNft.approve(nftMarketplace.address, TOKEN_ID)
          })

          it("deploys succesfully", async () => {
              assert(nftMarketplace.address)
          })

          describe("listItem", () => {
              it("it's already listed", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE))
                      .to.be.revertedWithCustomError(
                          nftMarketplace,
                          "NftMarketplace__AlreadyListed"
                      )
                      .withArgs(basicNft.address, TOKEN_ID)
              })

              it("only owner can list it", async () => {
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await basicNft.approve(playerConnectedNftMarketplace.address, TOKEN_ID)
                  await expect(
                      playerConnectedNftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NotOwner")
              })

              it("lists NFT successfully", async () => {
                  expect(await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.emit(
                      "ItemListed"
                  )
              })

              it("reverts if price is <= 0", async () => {
                  const testPrice = ethers.utils.parseEther("0")
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, testPrice)
                  ).to.be.revertedWithCustomError(
                      nftMarketplace,
                      "NftMarketplace__PriceMustBeAboveZero"
                  )
              })

              it("reverts if not approved for marketplace by the owner", async () => {
                  const operatorAddress = await basicNft.getApproved(TOKEN_ID)
                  expect(operatorAddress == deployer).to.be.revertedWithCustomError(
                      nftMarketplace,
                      "NftMarketplace__NotApprovedForMarketplace"
                  )
              })
          })

          describe("buyItem", () => {
              it("reverts if not listed", async () => {
                  // we skip listing
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await expect(
                      playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: PRICE,
                      })
                  )
                      .to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NotListed")
                      .withArgs(basicNft.address, TOKEN_ID)
              })

              it("make sure they are sending enough money", async () => {
                  const testPrice = ethers.utils.parseEther("0")
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  // we now list the nft
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: testPrice,
                      })
                  )
                      .to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__PriceNotMet")
                      .withArgs(basicNft.address, TOKEN_ID, PRICE)
              })

              it("listed nft can be bought", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE) // listing
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  expect(
                      await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: PRICE,
                      })
                  ).to.emit("ItemBought")

                  const newOwner = await basicNft.ownerOf(TOKEN_ID)
                  const deployerProceeds = await nftMarketplace.getProceeds(deployer.address)

                  assert(newOwner.toString() == player.address)
                  assert(deployerProceeds.toString() == PRICE.toString())
              })
          })
      })
