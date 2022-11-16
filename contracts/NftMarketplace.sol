// SPDX-License-Identifier: SEE LICENSE IN LICENSE

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// What are working on
// 1. `listItem:` List NFTs on the marketplace
// 2. `buyItem:` Buy the NFTs
// 3. `cancelItem:` Cancel a listing
// 4. `updateListing:` Update Price
// 5. `withdrawProceeds:` Withdraw payment for my bought NFTs

pragma solidity ^0.8.7;

error NftMarketplace__PriceMustBeAboveZero();
error NftMarketplace__NotApprovedForMarketplace();
error NftMarketplace__AlreadyListed(address nftAddress, uint256 tokenId);
error NftMarketplace__NotOwner();
error NftMarketplace__NotListed(address nftAddress, uint256 tokenId);
error NftMarketplace__PriceNotMet(
    address nftAddress,
    uint256 tokenId,
    uint256 price
);
error NftMarketplace__NoProceeds();
error NftMarketplace__TransferFailed();

contract NftMarketplace is ReentrancyGuard {
    struct Listing {
        uint256 price;
        address seller;
    }

    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event ItemBought(
        address indexed buyer,
        address indexed nftAddress,
        uint256 tokenId,
        uint256 price
    );

    event ItemCanceled(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId
    );

    // NFT contract address -> NFT tokeId -> listing
    mapping(address => mapping(uint256 => Listing)) private s_listings;
    // Seller address -> amount earned
    mapping(address => uint256) private s_proceeds;

    constructor() {}

    //////////////////
    // Modifiers
    //////////////////

    modifier notListed(
        address nftAddress,
        uint256 tokenId,
        address owner
    ) {
        Listing memory listings = s_listings[nftAddress][tokenId];
        if (listings.price > 0) {
            revert NftMarketplace__AlreadyListed(nftAddress, tokenId);
        }
        _;
    }

    modifier isListed(address nftAddress, uint256 tokenId) {
        Listing memory listings = s_listings[nftAddress][tokenId];
        if (listings.price <= 0) {
            revert NftMarketplace__NotListed(nftAddress, tokenId);
        }
        _;
    }

    modifier isOwner(
        address nftAddress,
        uint256 tokenId,
        address spender
    ) {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        if (spender != owner) {
            revert NftMarketplace__NotOwner();
        }
        _;
    }

    //////////////////
    // Main Functions
    //////////////////
    /*
     * @notice Method for listing NFT
     * @param nftAddress Address of NFT contract
     * @param tokenId Token ID of NFT
     * @param price sale price for each item
     */
    function listItem(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    )
        external
        notListed(nftAddress, tokenId, msg.sender) // check to see if it's already listed
        isOwner(nftAddress, tokenId, msg.sender) // only owner of the nft, of that tokenId can list it
    {
        if (price <= 0) {
            revert NftMarketplace__PriceMustBeAboveZero();
        }

        // Owners hold their NFT, and give the marketplace approval to sell the Nft for them.
        IERC721 nft = IERC721(nftAddress);
        if (nft.getApproved(tokenId) != address(this)) {
            revert NftMarketplace__NotApprovedForMarketplace();
        }

        // data structure for listing the NFTs
        // array or mapping??
        // We use mapping since using arrays may get tricky as the array gets bigger and bigger.
        // Remember, we have to tranfer these NFTs everytime someone buys. Plus mappings are gas efficient.
        s_listings[nftAddress][tokenId] = Listing(price, msg.sender);
        // since we are updating a mapping we now need to emit an event (Best Practise)
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }

    function buyItem(address nftAddress, uint256 tokenId)
        external
        payable
        nonReentrant // prevent a RE-ENTRANCY ATTACK
        isListed(nftAddress, tokenId)
    {
        // make sure they are sending enough money
        Listing memory listedItem = s_listings[nftAddress][tokenId];
        if (msg.value < listedItem.price) {
            revert NftMarketplace__PriceNotMet(
                nftAddress,
                tokenId,
                listedItem.price
            );
        }

        // update proceeds / keep track how much money people have made selling their NFTs

        // Why don't we just send the money to the seller?
        // we shift the risk associated with transferring ether/money to the user.
        // https://fravoll.github.io/solidity-patterns/pull_over_push.html
        // Sending money to the user ❌
        // Have them withdraw the money ✅

        s_proceeds[listedItem.seller] =
            s_proceeds[listedItem.seller] +
            msg.value;
        // once it's bought delete the listing / delete the entry in the mapping
        delete (s_listings[nftAddress][tokenId]);
        // then tranfer it
        // we change state first, then transfer the Nft to prevent a RE-ENTRANCY ATTACK
        IERC721(nftAddress).safeTransferFrom(
            listedItem.seller, // from
            msg.sender, // to
            tokenId
        );
        // check to make sure the NFT was transfered
        emit ItemBought(msg.sender, nftAddress, tokenId, listedItem.price);
    }

    function cancelListing(address nftAddress, uint256 tokenId)
        external
        isOwner(nftAddress, tokenId, msg.sender)
        isListed(nftAddress, tokenId)
    {
        delete (s_listings[nftAddress][tokenId]);
        emit ItemCanceled(msg.sender, nftAddress, tokenId);
    }

    function updateListing(
        address nftAddress,
        uint256 tokenId,
        uint256 newPrice
    )
        external
        isOwner(nftAddress, tokenId, msg.sender)
        isListed(nftAddress, tokenId)
    {
        s_listings[nftAddress][tokenId].price = newPrice;
        emit ItemListed(msg.sender, nftAddress, tokenId, newPrice); // we just use ItemListed event because updating is same as re-listing
    }

    function withdrawProceeds() external {
        uint256 proceeds = s_proceeds[msg.sender];
        if (proceeds <= 0) {
            revert NftMarketplace__NoProceeds();
        }
        s_proceeds[msg.sender] = 0; // setting state first to avoid any chance for RE-ENTRANCY ATTACK
        (bool success, ) = payable(msg.sender).call{value: proceeds}("");
        if (!success) {
            revert NftMarketplace__TransferFailed();
        }
    }

    //////////////////
    // Getter Functions
    //////////////////

    function getListing(address nftAddress, uint56 tokenId)
        external
        view
        returns (Listing memory)
    {
        return s_listings[nftAddress][tokenId];
    }

    function getProceeds(address seller) external view returns (uint256) {
        return s_proceeds[seller];
    }
}
