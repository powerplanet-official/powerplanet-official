// The storefront needs searchable specs, but not duplicated import/source data.
// Keep the original /api/store response available to existing integrations.
export function publicStorefrontData(data) {
  const fields = [
    'id',
    'name',
    'categoryId',
    'categoryIds',
    'brand',
    'model',
    'description',
    'specs',
    'image',
    'images',
    'price',
    'originalPrice',
    'stock',
    'availability',
    'minQuantity',
    'status',
    'featured',
    'sourceCheckedAt',
  ];
  return {
    settings: data.settings,
    categories: data.categories,
    products: data.products
      .filter((product) => product.status !== 'draft')
      .map((product) =>
        Object.fromEntries(
          fields.filter((key) => product[key] !== undefined).map((key) => [key, product[key]]),
        ),
      ),
  };
}
