DO $$
DECLARE
  item jsonb;
  variant jsonb;
  product_id uuid;
  variant_id uuid;
  catalog jsonb := '[
    {"name":"Sweets","category":"Sweets","variants":[["Crystal Mints",0.05],["Dandy Pink Gun",0.05],["Toffee",0.05]]},
    {"name":"Lolipops","category":"Sweets","variants":[["Stambo",0.10],["Big Boom",0.10],["Eclair",0.10],["Yogeta",0.10]]},
    {"name":"Cigarettes","category":"Tobacco","variants":[["Mint",0.50],["Pegasus",0.50],["Flame",0.50],["Storm",0.05],["Everest",0.06],["Madison",0.06]]},
    {"name":"Cerevita","category":"Groceries","variants":[["Corn & Wheat",3.00]]},
    {"name":"Instant Porridge","category":"Groceries","variants":[["Standard",1.50]]},
    {"name":"Rice 2kg","category":"Groceries","variants":[["Mr Rice White",2.00],["Mr Rice Parboiled",2.00],["Raha White",2.00],["Raha Parboiled",2.00],["Top Chef",2.00],["Mahatma",2.00],["Cook More",2.00]]},
    {"name":"Rice 5kg","category":"Groceries","variants":[["Mr Rice White",5.00],["Raha White",5.00],["Basmati",10.50],["Cook More",5.25]]},
    {"name":"Pork Pie","category":"Bakery","variants":[["Standard",0.50]]},
    {"name":"Big Bites","category":"Bakery","variants":[["Standard",0.50]]},
    {"name":"Revive Juice","category":"Drinks","variants":[["250ml",0.25],["500ml",0.50],["1 Litre",1.00]]},
    {"name":"Yoghurt","category":"Dairy","variants":[["Standard",0.50]]},
    {"name":"Chocolate","category":"Sweets","variants":[["Mint Crisp",0.50],["Milk",0.50]]},
    {"name":"Cadbury Chocolate","category":"Sweets","variants":[["Top Deck",1.00],["Fruit & Nut",1.00],["Milk",1.00]]},
    {"name":"Matemba","category":"Groceries","variants":[["50g",0.50],["100g",1.00]]},
    {"name":"Stationery","category":"Stationery","variants":[["Ruler",0.50],["Pencil",0.25],["Pen",0.25],["Plastic Cover",0.50],["Khaki Cover",0.50]]},
    {"name":"Flour","category":"Groceries","variants":[["Mega All Purpose",2.00],["Mega Self-raising",2.00],["Gloria Self-raising",2.00]]},
    {"name":"Mega Snax","category":"Snacks","variants":[["Small 100g",0.25],["Big 150g",0.50]]},
    {"name":"Spaghetti","category":"Groceries","variants":[["Bela 50g",0.50]]},
    {"name":"Sugar","category":"Groceries","variants":[["GoldStar",3.00],["Huletts",2.70],["Tapitapi",2.60]]},
    {"name":"Instant Cereal","category":"Groceries","variants":[["Standard",2.00]]},
    {"name":"Cooking Oil 2 Litres","category":"Groceries","variants":[["Zimgold",3.50],["Olivine",3.50],["Puredrop",3.50],["Golden Glow",3.30]]},
    {"name":"Cooking Oil","category":"Groceries","variants":[["D'Lite 750ml",1.50],["D'Lite 375ml",1.00]]},
    {"name":"Rabroy","category":"Groceries","variants":[["500ml",1.50]]},
    {"name":"Salad Cream","category":"Groceries","variants":[["750ml",3.00]]},
    {"name":"Karinga","category":"Groceries","variants":[["Standard",0.50]]},
    {"name":"Royco","category":"Groceries","variants":[["Beef",0.50],["Chicken",0.50]]},
    {"name":"Know Soup","category":"Groceries","variants":[["Standard",0.50]]},
    {"name":"Jam","category":"Groceries","variants":[["Sun Jam",1.50],["Marmalade Jam",1.75]]},
    {"name":"Fresh Milk","category":"Dairy","variants":[["Chimombe 1 Litre",1.00],["Dandairy 1 Litre",1.00],["250ml",1.00]]},
    {"name":"Chocolate Milk","category":"Dairy","variants":[["250ml",0.50]]},
    {"name":"Cremora","category":"Dairy","variants":[["Sachet",1.75],["Box",3.50]]},
    {"name":"Ellis Brown","category":"Groceries","variants":[["Sachet",1.75],["Box",3.50]]},
    {"name":"Tinned Fish","category":"Groceries","variants":[["Lucky Star",1.00]]},
    {"name":"Ricoffy","category":"Groceries","variants":[["Small",1.50],["Big",3.00]]},
    {"name":"Everyday Powdered Milk","category":"Dairy","variants":[["Standard",3.50]]},
    {"name":"Steri Milk","category":"Dairy","variants":[["Standard",1.00]]},
    {"name":"Tinned Beef","category":"Groceries","variants":[["Bull Brand",2.00]]},
    {"name":"Milk-it","category":"Dairy","variants":[["Standard",0.50]]},
    {"name":"Chungs","category":"Snacks","variants":[["Small",0.50],["Big",1.00]]},
    {"name":"Smiley Chips","category":"Snacks","variants":[["Single",0.05],["Pack",1.00]]},
    {"name":"Eggs","category":"Dairy","variants":[["3 Eggs",0.50],["6 Eggs",1.00],["Crate",4.50]]},
    {"name":"Tissue","category":"Household","variants":[["Two Ply 1",0.50],["Two Ply 2",1.00],["18-roll Pack",9.00]]},
    {"name":"Satiskin","category":"Personal Care","variants":[["2L Coconut",4.50],["2L Lavender",4.50],["2L Wild Rose",4.50],["2L Peach Blossom",4.50],["2L Luxurious",5.00],["1L",2.25]]},
    {"name":"Bath Soap","category":"Personal Care","variants":[["Geisha",1.00],["Lux",1.00],["Protex",1.00],["Detol",1.00],["Lifebuoy",1.00],["Hi-life",0.50],["Romance",0.60],["Jade",0.80]]},
    {"name":"Washing Powder","category":"Household","variants":[["MAQ 2kg",5.00],["Aloha 2kg",4.50],["Aloha 1kg",2.50],["Aloha 500g",1.25],["Boom 2kg",4.50],["Boom 1kg",2.50],["Boom 500g",1.25]]},
    {"name":"Handy Andy","category":"Household","variants":[["Standard",2.00]]},
    {"name":"Cleancloud Body Wash","category":"Personal Care","variants":[["Standard",3.50]]},
    {"name":"Cool Splash Drink","category":"Drinks","variants":[["Raspberry 5L",4.00],["Cream Soda 5L",4.00],["Blackberry 5L",4.00],["Orange 5L",4.00]]},
    {"name":"Baseline Drink","category":"Drinks","variants":[["Raspberry 5L",3.50],["Cream Soda 5L",3.50],["Blackberry 5L",3.50],["Orange 5L",3.50]]},
    {"name":"Mazoe Drink","category":"Drinks","variants":[["Raspberry 2L",3.00],["Cream Soda 2L",3.00],["Peach 2L",3.00],["Blackberry 2L",3.50],["Orange Crush 2L",4.00]]},
    {"name":"Boom Paste","category":"Household","variants":[["Standard",0.50]]},
    {"name":"Toast Leaf","category":"Groceries","variants":[["Standard",0.25]]},
    {"name":"Aromat","category":"Groceries","variants":[["Standard",1.00]]},
    {"name":"Toothbrush","category":"Personal Care","variants":[["Standard",0.50]]},
    {"name":"Toffee Bar","category":"Sweets","variants":[["2 Pack",0.25]]},
    {"name":"Cuettie","category":"Personal Care","variants":[["Small",1.00],["Medium",1.00],["Large",1.00],["Extra Large",1.00]]},
    {"name":"Softcare","category":"Personal Care","variants":[["Small Packet",1.00],["Medium Packet",1.00],["Large Packet",1.00],["Extra Large Packet",1.00],["Small Pack",4.50],["Medium Pack",4.50],["Large Pack",4.50],["Extra Large Pack",4.50]]},
    {"name":"Baker's Inn Bread","category":"Bakery","variants":[["1 Loaf",1.00]]},
    {"name":"Unbranded Bread","category":"Bakery","variants":[["1 Loaf",0.50],["2 Loaves",1.00]]},
    {"name":"Black Soil Mealie Meal","category":"Groceries","variants":[["5kg",3.00],["10kg",5.00]]},
    {"name":"Maputi","category":"Snacks","variants":[["Red Package",1.00],["Blue Package",1.00]]},
    {"name":"Matches","category":"Household","variants":[["1 Box",0.05],["5 Boxes",0.25],["1 Carton",0.50]]}
  ]'::jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(catalog) LOOP
    SELECT id INTO product_id FROM public.products WHERE lower(name) = lower(item->>'name') LIMIT 1;
    IF product_id IS NULL THEN
      INSERT INTO public.products (name, category, base_price) VALUES (item->>'name', item->>'category', (item->'variants'->0->>1)::numeric) RETURNING id INTO product_id;
    END IF;
    FOR variant IN SELECT * FROM jsonb_array_elements(item->'variants') LOOP
      SELECT id INTO variant_id FROM public.product_variants WHERE product_id = product_id AND lower(variant_name) = lower(variant->>0) LIMIT 1;
      IF variant_id IS NULL THEN
        INSERT INTO public.product_variants (product_id, variant_name, selling_price, sku) VALUES (product_id, variant->>0, (variant->>1)::numeric, upper(regexp_replace(item->>'name' || '-' || variant->>0, '[^A-Za-z0-9]+', '-', 'g'))) RETURNING id INTO variant_id;
      ELSE
        UPDATE public.product_variants SET selling_price = (variant->>1)::numeric WHERE id = variant_id;
      END IF;
      INSERT INTO public.stock (variant_id, quantity) VALUES (variant_id, 40) ON CONFLICT (variant_id) DO UPDATE SET quantity = 40;
    END LOOP;
  END LOOP;
END $$;
