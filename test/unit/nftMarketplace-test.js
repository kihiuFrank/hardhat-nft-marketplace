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

              it("proceeds are updated accordingly after purchase", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE) // listing
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  })
                  const newProceeds = await nftMarketplace.getProceeds(deployer.address)
                  assert.equal(newProceeds.toString(), PRICE.toString())
              })

              it("deletes listing after purchase", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE) // listing
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  })
                  const result = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert.equal(result.price.toString(), "0")
              })

              it("listed nft can be bought / was tranfered", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE) // listing
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  expect(
                      await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: PRICE,
                      })
                  ).to.emit("ItemBought")
                  const newOwner = await basicNft.ownerOf(TOKEN_ID)
                  assert(newOwner.toString() == player.address)
              })
          })

          describe("cancelListing", () => {
              it("can only be cancelled by owner", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await expect(
                      playerConnectedNftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NotOwner")
              })

              it("reverts if not listed", async () => {
                  await expect(nftMarketplace.cancelListing(basicNft.address, TOKEN_ID))
                      .to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NotListed")
                      .withArgs(basicNft.address, TOKEN_ID)
              })

              it("deletes listing & emits an event if succesfully canceled", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  expect(await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)).to.emit(
                      "ItemCanceled"
                  )
                  const result = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert.equal(result.price.toString(), "0")
              })
          })

          describe("updateListing", () => {
              it("must be listed and updated by owner", async () => {
                  // must be listed / skip listing
                  await expect(nftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE))
                      .to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NotListed")
                      .withArgs(basicNft.address, TOKEN_ID)
                  // updated by owner
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await expect(
                      playerConnectedNftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NotOwner")
              })

              it("updates a listing & emit an event", async () => {
                  const newPrice = ethers.utils.parseEther("1")
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE) //listing
                  // update listing
                  expect(
                      await nftMarketplace.updateListing(basicNft.address, TOKEN_ID, newPrice)
                  ).to.emit("ItemListed") // emits an event

                  const result = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  const weiValue = result.price
                  const ethValue = ethers.utils.formatEther(weiValue)
                  assert.equal(ethValue.toString(), "1.0")
              })
          })

          describe("withdrawProceeds", () => {
              it("reverts if there are no proceeds", async () => {
                  // we skip connect buyer/player and hence we don't buy
                  await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWithCustomError(
                      nftMarketplace,
                      "NftMarketplace__NoProceeds"
                  )
              })

              it("resets proceeds to 0 & succesfully withdraws proceeds", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE) // listing
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player) // connect buyer
                  await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                      // buys nft
                      value: PRICE,
                  })
                  const proceeds = await nftMarketplace.getProceeds(deployer.address) // in wei
                  const ethValue = ethers.utils.formatEther(proceeds)
                  assert.equal(ethValue.toString(), "0.1")
                  // withdrawing
                  await nftMarketplace.withdrawProceeds()
                  const newProceeds = await nftMarketplace.getProceeds(deployer.address)
                  assert.equal(newProceeds, "0")
              })

              it("reverts if transfer fails", async () => {
                  //player1 = accounts[2]
                  const withdrawAmount = ethers.utils.parseEther("100")
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE) // list the nft
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player) // connect player 1
                  await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                      // have player 1 buy the nft so deployer can have some proceeds.
                      //This is to avoid reverting with NftMarketplace__NoProceeds()
                      // buys nft
                      value: PRICE,
                  })
                  //await nftMarketplace.getProceeds(deployer.address) // so there are proceeds at this point
                  //const player1NftMarketplace = nftMarketplace.connect(player)
                  //nftMarketplace = await ethers.getContract("NftMarketplace", player)
                  const proceeds = await nftMarketplace.getProceeds(deployer.address) // in wei
                  const ethValue = ethers.utils.formatEther(proceeds)
                  console.log(`${ethValue.toString()} ETH available`)

                  await expect(
                      nftMarketplace.withdrawProceeds({ value: withdrawAmount }) // Withdraw more than available.
                  ).to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__TransferFailed")
              })
          })
      })
