export const groups = [
 ['solar-panels','Solar Panels',['Monocrystalline Panels','Bi-Facial Solar Panels','Longi Solar Panels','Jinko Solar Panels','Canadian Solar Panels','JA Solar Panels','Trina Solar Panels','Astronergy Solar Panels']],
 ['solar-inverters','Solar Inverters',['Hybrid Inverters','On Grid Inverters','Off Grid Inverters','All In One ESS Inverters','Solar Pump Inverters','Smart Meters & Export Managers','Parallel Kits & Wi-Fi Devices']],
 ['solar-batteries','Solar Batteries',['Lithium-Ion Batteries','Tall Tubular Deep Cycle Batteries','Lead Acid Batteries','Low Voltage Lithium Batteries','High Voltage Lithium Batteries','BESS Lithium Systems']],
 ['portable-systems','Portable Power Systems',['Portable Power Stations','Portable Solar Panels','Home Backup Systems']],
 ['solar-accessories','Solar Accessories',['AC / DC Wires','AC / DC Breakers & Fuses','Solar Mounting Structures','Distribution Boxes & Changeovers','MC4 Connectors']],
 ['other-solar','Other Solar Products',['Solar Charge Controllers','Solar Street Lights','Solar Water Heaters','Solar Submersible Pumps']],
 ['solar-packages','Solar Packages',['Residential Solar Systems','Commercial Solar Systems','Solar Combo Deals']]
];
export const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const categories = groups.flatMap(([id,name,children])=>[{id,name,parentId:null},...children.map(name=>({id:slugify(name),name,parentId:id}))]);
export const samples = [
 ['Monocrystalline Solar Panel','solar-panels','panel','High-efficiency panel options for rooftop solar systems.'],
 ['Bi-Facial Solar Panel','solar-panels','panel','Explore dual-sided solar generation for your installation.'],
 ['Hybrid Solar Inverter','solar-inverters','inverter','Combine solar generation, grid supply and battery backup.'],
 ['On Grid Solar Inverter','solar-inverters','inverter','Solar conversion solutions for grid-connected installations.'],
 ['Lithium Solar Battery','solar-batteries','battery','Energy storage options for home and business backup.'],
 ['Tubular Deep Cycle Battery','solar-batteries','battery','Deep-cycle battery options for solar energy storage.'],
 ['Portable Power Station','portable-systems','portable','Portable energy for backup and outdoor use.'],
 ['Solar DC Protection Kit','solar-accessories','accessory','Protection components selected to suit your solar system.'],
 ['Solar Mounting Structure','solar-accessories','panel','Mounting options for rooftop solar installations.'],
 ['Solar Charge Controller','other-solar','inverter','Charging control options for compatible solar systems.'],
 ['Residential Solar Package','solar-packages','panel','Request a custom system assessment for your home.'],
 ['Commercial Solar Package','solar-packages','panel','Discuss a solar solution matched to your business needs.']
].map(([name,categoryId,image,description],i)=>({id:`preview-${i+1}`,name,categoryId,image:`/images/${image}.svg`,description,brand:'Powerplanet',price:null,stock:0,status:'preview',featured:i<8,specs:'Specifications, availability and quotation will be confirmed by the team.',source:'Illustrative catalog entry — not extracted from Facebook'}));
