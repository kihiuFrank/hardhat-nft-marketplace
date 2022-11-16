// SPDX-License-Identifier: SEE LICENSE IN LICENSE

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

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

contract NftMarketplace {
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

    // NFT contract address -> NFT tokeId -> listing
    mapping(address => mapping(uint256 => Listing)) private s_listings;

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
}
