-- Seed the requested retail catalog without replacing existing products.
-- Product and variant names are used as idempotency keys so this can safely run on Lovable Cloud.
DO $$
DECLARE
  item jsonb;
  variant jsonb;
  product_id uuid;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements($catalog$[
    {"name":"Sweets","category":"Snacks","variants":[["Crystal mints",0.05],["Dandy pink gun",0.05],["Toffee",0.05],["Toffee - 7 sweets",0.25],["Toffee - 7 + 3 sweets",0.40],["Toffee - 14 + 4 sweets",0.70],["Toffee - 28 sweets",1.00],["Toffee bar - 2",0.25]]},
    {"name":"Lolipops","category":"Snacks","variants":[["Stambo",0.10],["Big Boom",0.10],["Eclair",0.10],["Yogeta",0.10],["2 lolipops",0.25],["5 lolipops",0.50],["10 lolipops",1.00]]},
    {"name":"Cigarettes","category":"Tobacco","variants":[["Mint box",0.50],["Pegasus box",0.50],["Flame box",0.50],["Storm - 1",0.05],["Storm - 5",0.25],["Storm - 10",0.50],["Storm box",1.00],["Everest - 1",0.06],["Everest - 4",0.25],["Everest - 8",0.50],["Everest - box minus 4",1.00],["Everest box",1.25],["Madison - 1",0.06],["Madison - 4",0.25],["Madison - 8",0.50],["Madison - box minus 4",1.00],["Madison box",1.25]]},
    {"name":"Cerevita","category":"Breakfast","variants":[["Corn & wheat",3.00]]},
    {"name":"Instant Porridge","category":"Breakfast","variants":[["Standard",1.50]]},
    {"name":"Rice 2kg","category":"Staples","variants":[["Mr Rice white",2.00],["Mr Rice parboiled",2.00],["Raha white",2.00],["Raha parboiled",2.00],["Top Chef",2.00],["Mahatma",2.00],["Cook More",2.00]]},
    {"name":"Rice 5kg","category":"Staples","variants":[["Mr Rice white",5.00],["Raha white",5.00],["Basmati",10.50],["Cook More",5.25]]},
    {"name":"Pork pie","category":"Bakery","variants":[["Standard",0.50]]},
    {"name":"Big bites","category":"Bakery","variants":[["Standard",0.50]]},
    {"name":"Revive juice","category":"Drinks","variants":[["250ml",0.25],["500ml",0.50],["1 litre",1.00]]},
    {"name":"Yoghurt","category":"Dairy","variants":[["Standard",0.50]]},
    {"name":"Chocolate","category":"Confectionery","variants":[["Mint crisp",0.50],["Milk",0.50]]},
    {"name":"Cadbury Chocolate","category":"Confectionery","variants":[["Top deck",1.00],["Fruit & nut",1.00],["Milk",1.00]]},
    {"name":"Matemba","category":"Food","variants":[["50g",0.50],["100g",1.00]]},
    {"name":"Stationery","category":"Stationery","variants":[["Ruler",0.50],["Pencil",0.25],["Pen",0.25],["Plastic cover",0.50],["Khaki cover",0.50]]},
    {"name":"Flour","category":"Staples","variants":[["Mega All Purpose",2.00],["Mega Self-raising",2.00],["Gloria Self-raising",2.00]]},
    {"name":"Mega Snax","category":"Snacks","variants":[["Small 100g",0.25],["Big 150g",0.50]]},
    {"name":"Spaghetti","category":"Staples","variants":[["Bela 50g",0.50]]},
    {"name":"Sugar","category":"Staples","variants":[["GoldStar",3.00],["Huletts",2.70],["Tapitapi",2.60]]},
    {"name":"Instant cereal","category":"Breakfast","variants":[["Standard",2.00]]},
    {"name":"Things chips","category":"Snacks","variants":[["Standard",0.50]]},
    {"name":"Cooking oil 2 litres","category":"Groceries","variants":[["Zimgold",3.50],["Olivine",3.50],["Puredrop",3.50],["Golden glow",3.30]]},
    {"name":"Cooking oil","category":"Groceries","variants":[["D'lite 750ml",1.50],["D'lite 375ml",1.00]]},
    {"name":"Rabroy 500ml","category":"Groceries","variants":[["Standard",1.50]]},
    {"name":"Salad cream 750ml","category":"Groceries","variants":[["Standard",3.00]]},
    {"name":"Karinga","category":"Groceries","variants":[["Standard",0.50]]},
    {"name":"Royco","category":"Groceries","variants":[["Beef",0.50],["Chicken",0.50]]},
    {"name":"Know soup","category":"Groceries","variants":[["Standard",0.50]]},
    {"name":"Jam","category":"Groceries","variants":[["Sun jam",1.50],["Marmalade jam",1.75]]},
    {"name":"Fresh milk 1 litre","category":"Dairy","variants":[["Chimombe",1.00],["Dandairy",1.00]]},
    {"name":"Fresh milk 250ml","category":"Dairy","variants":[["Standard",1.00]]},
    {"name":"Chocolate milk 250ml","category":"Dairy","variants":[["Standard",0.50]]},
    {"name":"Cremora","category":"Dairy","variants":[["Sachet",1.75],["Box",3.50]]},
    {"name":"Ellis Brown","category":"Beverages","variants":[["Sachet",1.75],["Box",3.50]]},
    {"name":"Tinned fish","category":"Canned goods","variants":[["Lucky Star",1.00]]},
    {"name":"Ricoffy","category":"Beverages","variants":[["Small",1.50],["Big",3.00]]},
    {"name":"Everyday powdered milk","category":"Dairy","variants":[["Standard",3.50]]},
    {"name":"Steri milk","category":"Dairy","variants":[["Standard",1.00]]},
    {"name":"Tinned beef","category":"Canned goods","variants":[["Bull Brand",2.00]]},
    {"name":"Milk-it","category":"Dairy","variants":[["Standard",0.50]]},
    {"name":"Chungs","category":"Snacks","variants":[["Small",0.50],["Big",1.00]]},
    {"name":"Smiley chips","category":"Snacks","variants":[["1",0.05],["3",0.15],["5",0.25],["10",0.50],["Pack",1.00]]},
    {"name":"Eggs","category":"Dairy","variants":[["3 eggs",0.50],["6 eggs",1.00],["Crate",4.50]]},
    {"name":"Tissue","category":"Household","variants":[["Two ply - 1",0.50],["Two ply - 2",1.00],["18-roll pack",9.00]]},
    {"name":"Satiskin","category":"Personal care","variants":[["2L Coconut",4.50],["2L Lavender",4.50],["2L Wild rose",4.50],["2L Peach blossom",4.50],["2L Luxurious",5.00],["1L",2.25]]},
    {"name":"Bath soap","category":"Personal care","variants":[["Geisha",1.00],["Lux",1.00],["Protex",1.00],["Detol",1.00],["Lifebuoy",1.00],["Hi-life",0.50],["Romance",0.60],["Jade",0.80]]},
    {"name":"Washing powder","category":"Household","variants":[["MAQ 2kg",5.00],["Aloha 2kg",4.50],["Aloha 1kg",2.50],["Aloha 500g",1.25],["Boom 2kg",4.50],["Boom 1kg",2.50],["Boom 500g",1.25]]},
    {"name":"Handy Andy","category":"Household","variants":[["Standard",2.00]]},
    {"name":"Cleancloud body wash","category":"Personal care","variants":[["Standard",3.50]]},
    {"name":"Cool Splash drink 5 litres","category":"Drinks","variants":[["Raspberry",4.00],["Cream soda",4.00],["Blackberry",4.00],["Orange",4.00]]},
    {"name":"Baseline drink 5 litres","category":"Drinks","variants":[["Raspberry",3.50],["Cream soda",3.50],["Blackberry",3.50],["Orange",3.50]]},
    {"name":"Mazoe drink 2 litres","category":"Drinks","variants":[["Raspberry",3.00],["Cream soda",3.00],["Peach",3.00],["Blackberry",3.50],["Orange crush",4.00]]},
    {"name":"Boom paste","category":"Household","variants":[["Standard",0.50]]},
    {"name":"Toast leaf","category":"Groceries","variants":[["Standard",0.25]]},
    {"name":"Aromat","category":"Groceries","variants":[["Standard",1.00]]},
    {"name":"Toothbrush","category":"Personal care","variants":[["Standard",0.50]]},
    {"name":"Cuettie","category":"Personal care","variants":[["Small",1.00],["Medium",1.00],["Large",1.00],["Extra large",1.00]]},
    {"name":"Softcare","category":"Personal care","variants":[["Small pack",4.50],["Medium pack",4.50],["Large pack",4.50],["Extra large pack",4.50],["Small packet",1.00],["Medium packet",1.00],["Large packet",1.00],["Extra large packet",1.00]]},
    {"name":"Bread","category":"Bakery","variants":[["Baker's Inn loaf",1.00],["Unbranded loaf",0.50],["Unbranded - 2 loaves",1.00]]},
    {"name":"Black soil mealie meal","category":"Staples","variants":[["5kg",3.00],["10kg",5.00]]},
    {"name":"Maputi","category":"Snacks","variants":[["Red - 1",0.05],["Red - 5",0.25],["Red - 10",0.50],["Red pack",1.00],["Blue pack",1.00]]},
    {"name":"Matches","category":"Household","variants":[["1 box",0.05],["5 boxes",0.25],["1 carton",0.50]]}
  ]$catalog$)
  LOOP
    SELECT id INTO product_id FROM public.products WHERE lower(name) = lower(item->>'name') LIMIT 1;
    IF product_id IS NULL THEN
      INSERT INTO public.products (name, category, base_price)
      VALUES (item->>'name', item->>'category', ((item->'variants'->0->>1)::numeric))
      RETURNING id INTO product_id;
    END IF;
    FOR variant IN SELECT * FROM jsonb_array_elements(item->'variants') LOOP
      INSERT INTO public.product_variants (product_id, variant_name, price, sku)
      VALUES (product_id, variant->>0, (variant->>1)::numeric, md5(lower((item->>'name') || ':' || (variant->>0))))
      ON CONFLICT (sku) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
