import { z } from 'zod';
const text=z.string().trim().min(1).max(200);
const image=z.string().max(2000).refine(s=>/^\/images\/(?:catalog\/[a-f0-9]{24}\.webp|[a-z0-9-]+\.(?:svg|jpg|png|webp))$/.test(s)||/^\/api\/product-images\/[a-f0-9]{64}\.webp$/.test(s)||/^https:\/\//.test(s),'Use an HTTPS image URL or an imported catalog photo');
export const productSchema=z.object({
  name:text,categoryId:text,categoryIds:z.array(text).max(100).default([]),
  brand:z.string().max(100).default(''),model:z.string().max(200).default(''),
  description:z.string().max(5000),specs:z.string().max(5000).default(''),
  image,images:z.array(image).max(20).default([]),
  price:z.number().nonnegative().max(100000000).nullable(),
  originalPrice:z.number().nonnegative().max(100000000).nullable().default(null),
  stock:z.number().int().min(0).max(1000000),
  availability:z.enum(['in-stock','out-of-stock','on-request']).optional(),
  sourceAvailability:z.string().max(200).optional(),
  minQuantity:z.number().int().min(1).max(100).default(1),
  status:z.enum(['draft','preview','published']),featured:z.boolean(),
  source:z.string().max(2000).default(''),sourceName:z.string().max(100).optional(),
  sourceUrl:z.url().startsWith('https://').optional(),sourceImage:z.url().startsWith('https://').optional(),
  sourceCheckedAt:z.iso.datetime().optional(),
  specifications:z.array(z.object({name:z.string().max(500),value:z.string().max(3000)})).max(200).optional(),
}).refine(p=>p.originalPrice===null||p.price===null||p.originalPrice>p.price,{message:'Original price must exceed the current price',path:['originalPrice']});
