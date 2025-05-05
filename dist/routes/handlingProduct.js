"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("cloudinary");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const index_1 = require("../db/index");
const middleware_1 = require("../middleware/middleware");
const router = express_1.default.Router();
router.use(express_1.default.json());
router.use((0, cors_1.default)());
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.post("/add-products", middleware_1.authMiddleware, upload.array("images"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, description, price, category, stock } = req.body;
        if (!name || !description || !price || !stock || !category) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }
        const imageUploads = [];
        // @ts-ignore
        for (const file of req.files) {
            const b64 = Buffer.from(file.buffer).toString("base64");
            let dataURI = "data:" + file.mimetype + ";base64," + b64;
            const cloudinaryResponse = yield cloudinary_1.v2.uploader.upload(dataURI, {
                folder: "products",
            });
            imageUploads.push({
                url: cloudinaryResponse.secure_url,
                altText: file.originalname,
                isPrimary: imageUploads.length === 0,
            });
        }
        const product = yield index_1.prisma.product.create({
            data: {
                name,
                description,
                price: parseFloat(price),
                category: category || null,
                stock: parseInt(stock),
                images: {
                    create: imageUploads,
                },
            },
            include: {
                images: true,
            },
        });
        res.status(201).json(product);
    }
    catch (error) {
        console.error("Error creating product:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}));
router.get("/product-details", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const productDetails = yield index_1.prisma.product.findMany({
            include: { images: true },
        });
        res.json({ productDetails });
    }
    catch (error) {
        res.status(500).json({ error: "Could not fetch products" });
    }
}));
router.get("/item-details/:id", middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const productDetails = yield index_1.prisma.product.findUnique({
            where: {
                id: id,
            },
            include: {
                images: true,
            },
        });
        res.json({ productDetails });
    }
    catch (error) {
        res.status(500).json({ error: "Could not fetch products" });
    }
}));
router.put("/update-products/:id", middleware_1.authMiddleware, upload.array("images"), // Add the multer middleware to parse multipart/form-data
(req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    try {
        // Check if req.body exists after multer processing
        if (!req.body) {
            res.status(400).json({ error: "Request body is missing" });
            return;
        }
        console.log("Request body:", req.body); // For debugging
        const { name, description, price, category, stock, imagesToDelete } = req.body;
        // Handle existing product update
        const updatedProduct = yield index_1.prisma.product.update({
            where: { id },
            data: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (name !== undefined && { name })), (description !== undefined && { description })), (price !== undefined && { price: parseFloat(price) })), (category !== undefined && { category })), (stock !== undefined && { stock: parseInt(stock) })), { updatedAt: new Date() }),
            include: {
                images: true, // Include images in the response
            },
        });
        // Process image deletion if needed
        if (imagesToDelete) {
            try {
                const imageIds = JSON.parse(imagesToDelete);
                // Find images to get their URLs for Cloudinary deletion
                const imagesToRemove = yield index_1.prisma.productImage.findMany({
                    where: {
                        id: { in: imageIds },
                        productId: id
                    }
                });
                // Delete images from Cloudinary
                for (const image of imagesToRemove) {
                    try {
                        // Extract public_id from Cloudinary URL
                        const publicId = (_a = image.url.split('/').pop()) === null || _a === void 0 ? void 0 : _a.split('.')[0];
                        if (publicId) {
                            yield cloudinary_1.v2.uploader.destroy(`products/${publicId}`);
                        }
                    }
                    catch (cloudinaryError) {
                        console.error("Error deleting from Cloudinary:", cloudinaryError);
                        // Continue with other deletions even if one fails
                    }
                }
                // Delete from database
                yield index_1.prisma.productImage.deleteMany({
                    where: {
                        id: { in: imageIds },
                        productId: id
                    }
                });
            }
            catch (parseError) {
                console.error("Error parsing imagesToDelete:", parseError);
            }
        }
        // Process new image uploads
        const imageUploads = [];
        // @ts-ignore - req.files comes from multer
        if (req.files && req.files.length > 0) {
            // @ts-ignore
            for (const file of req.files) {
                const b64 = Buffer.from(file.buffer).toString("base64");
                let dataURI = "data:" + file.mimetype + ";base64," + b64;
                const cloudinaryResponse = yield cloudinary_1.v2.uploader.upload(dataURI, {
                    folder: "products",
                });
                // @ts-ignore
                const isPrimary = updatedProduct.images.length === 0 && imageUploads.length === 0;
                imageUploads.push({
                    url: cloudinaryResponse.secure_url,
                    altText: file.originalname,
                    isPrimary,
                    productId: id
                });
            }
            // Add new images to the product
            if (imageUploads.length > 0) {
                yield index_1.prisma.productImage.createMany({
                    data: imageUploads
                });
            }
        }
        // Fetch the final updated product with all changes
        const finalProduct = yield index_1.prisma.product.findUnique({
            where: { id },
            include: { images: true }
        });
        res.status(200).json({
            message: "Product updated successfully",
            updatedProduct: finalProduct
        });
    }
    catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({
            error: "Error updating product",
            details: error.message
        });
    }
}));
router.delete("/delete-products/:id", middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield index_1.prisma.productImage.deleteMany({ where: { productId: id } });
        yield index_1.prisma.product.delete({ where: { id } });
        res.status(200).json({ message: "Product deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ error: "Error deleting product" });
    }
}));
exports.default = router;
