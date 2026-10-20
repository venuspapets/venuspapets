const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

type ServicePrices = {
  service_prices: { size_id: string; price: number }[];
  service_breed_prices: { breed: string; price: number }[];
};

/** Precio de un servicio para una mascota: precio especial de su raza y, si no hay, el de su tamaño. null = no se ofrece. */
export function priceFor(service: ServicePrices, pet: { breed: string; size_id: string | null }): number | null {
  if (pet.breed) {
    const special = service.service_breed_prices.find(b => norm(b.breed) === norm(pet.breed));
    if (special) return special.price;
  }
  if (pet.size_id) {
    const bySize = service.service_prices.find(p => p.size_id === pet.size_id);
    if (bySize) return bySize.price;
  }
  return null;
}
