import express, { Request, Response, Router } from "express";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();
import { prisma } from "../db/index";
import { authMiddleware } from "../middleware/middleware";
const router: Router = express.Router();
router.use(express.json());
router.use(cors());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/add-products",
  authMiddleware,
  upload.array("images"),
  async (req: Request, res: Response) => {
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

        const cloudinaryResponse = await cloudinary.uploader.upload(dataURI, {
          folder: "products",
        });

        imageUploads.push({
          url: cloudinaryResponse.secure_url,
          altText: file.originalname,
          isPrimary: imageUploads.length === 0,
        });
      }

      const product = await prisma.product.create({
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
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.get("/product-details", async (req: Request, res: Response) => {
  try {
    const productDetails = await prisma.product.findMany({
      include: { images: true },
    });
    res.json({ productDetails });
  } catch (error) {
    res.status(500).json({ error: "Could not fetch products" });
  }
});

router.get(
  "/item-details/:id",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const productDetails = await prisma.product.findUnique({
        where: {
          id: id,
        },
        include: {
          images: true,
        },
      });
      res.json({ productDetails });
    } catch (error) {
      res.status(500).json({ error: "Could not fetch products" });
    }
  }
);

router.put(
  "/update-products/:id",
  authMiddleware,
  upload.array("images"), // Add the multer middleware to parse multipart/form-data
  async (req: Request, res: Response) => {
    const { id } = req.params;
    
    try {
      // Check if req.body exists after multer processing
      if (!req.body) {
         res.status(400).json({ error: "Request body is missing" });
         return
      }
      
      console.log("Request body:", req.body); // For debugging
      
      const { name, description, price, category, stock, imagesToDelete } = req.body;
      
      // Handle existing product update
      const updatedProduct = await prisma.product.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(price !== undefined && { price: parseFloat(price) }),
          ...(category !== undefined && { category }),
          ...(stock !== undefined && { stock: parseInt(stock) }),
          updatedAt: new Date(),
        },
        include: {
          images: true, // Include images in the response
        },
      });
      
      // Process image deletion if needed
      if (imagesToDelete) {
        try {
          const imageIds = JSON.parse(imagesToDelete);
          
          // Find images to get their URLs for Cloudinary deletion
          const imagesToRemove = await prisma.productImage.findMany({
            where: { 
              id: { in: imageIds },
              productId: id
            }
          });
          
          // Delete images from Cloudinary
          for (const image of imagesToRemove) {
            try {
              // Extract public_id from Cloudinary URL
              const publicId = image.url.split('/').pop()?.split('.')[0];
              if (publicId) {
                await cloudinary.uploader.destroy(`products/${publicId}`);
              }
            } catch (cloudinaryError) {
              console.error("Error deleting from Cloudinary:", cloudinaryError);
              // Continue with other deletions even if one fails
            }
          }
          
          // Delete from database
          await prisma.productImage.deleteMany({
            where: { 
              id: { in: imageIds },
              productId: id
            }
          });
        } catch (parseError) {
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
          
          const cloudinaryResponse = await cloudinary.uploader.upload(dataURI, {
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
          await prisma.productImage.createMany({
            data: imageUploads
          });
        }
      }
      
      // Fetch the final updated product with all changes
      const finalProduct = await prisma.product.findUnique({
        where: { id },
        include: { images: true }
      });
      
      res.status(200).json({ 
        message: "Product updated successfully", 
        updatedProduct: finalProduct 
      });
    } catch (error:any) {
      console.error("Error updating product:", error);
      res.status(500).json({ 
        error: "Error updating product", 
        details: error.message 
      });
    }
  }
);
router.delete(
  "/delete-products/:id",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      await prisma.productImage.deleteMany({ where: { productId: id } });
      await prisma.product.delete({ where: { id } });
      res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Error deleting product" });
    }
  }
);

export default router;
