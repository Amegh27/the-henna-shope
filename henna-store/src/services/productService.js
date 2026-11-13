import API from "../api";

export const getProducts = async () => {
  const response = await fetch(`${API}/products`);

  if (!response.ok) {
    throw new Error("Failed to fetch products");
  }

  const data = await response.json();

  // Convert MongoDB product structure into frontend structure
  return data.products.map((product) => ({
    ...product,
    id: product._id,
    desc: product.description,
  }));
};