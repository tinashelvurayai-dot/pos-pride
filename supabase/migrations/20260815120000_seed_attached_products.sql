DO $$
DECLARE
  item jsonb;
  product_id uuid;
  variant jsonb;
  variant_id uuid;
  catalog jsonb := '[
    {"name":"Sweets","category":"Sweets","variants":[["Crystal Mints",0.05],["Dandy Pink Gun",0.05],["Toffee",0.05],["Toffee bar",0.125]]},
    {"name":"Lollipops","category":"Sweets","variants":[["Stambo",0.10],["Big Boom",0.10],["Eclair",0.10],["Yogeta",0.10]]},
    {"name":"Cigarettes","category":"Tobacco","variants":[["Mint box",0.50],["Pegasus box",0.50],["Flame box",0.50],["Storm",0.05],["Everest",0.06],["Madison",0.06]]},
    {"name":"Cerevita","category":"Breakfast","variants":[["Corn & Wheat",3.00]]},
    {"name":"Instant Porridge","category":"Breakfast","variants":[["Standard",1.50]]},
    {"name":"Rice 2kg","category":"Groceries","variants":[["Mr Rice White",2.00],["Mr Rice Parboiled",2.00],["Raha White",2.00],["Raha Parboiled",2.00],["Top Chef",2.00],["Mahatma",2.00],["Cook More",2.00]]},
    {"name":"Rice 5kg","category":"Groceries","variants":[["Mr Rice White",5.00],["Raha White",5.00],["Basmati",10.50],["Cook More",5.25]]},
    {"name":"Pork Pie","category":"Bakery","variants":[["Standard",0.50]]},
    {"name":"Big Bites","category":"Bakery","variants":[["Standard",0.50]]},
    {"name":"Revive Juice","category":"Beverages","variants":[["250ml",0.25],["500ml",0.50],["1 litre",1.00]]},
    {"name":"Yoghurt","category":"Dairy","variants":[["Standard",0.50]]},
    {"name":"Chocolate","category":"Sweets","variants":[["Mint Crisp",0.50],["Milk",0.50]]},
    {"name":"Cadbury Chocolate","category":"Sweets","variants":[["Top Deck",1.00],["Fruit & Nut",1.00],["Milk",1.00]]},
    {"name":"Matemba","category":"Groceries","variants":[["50g",0.50],["100g",1.00]]},
    {"name":"Stationery","category":"Stationery","variants":[["Ruler",0.50],["Pencil",0.25],["Pen",0.25]]},
    {"name":"Covers","category":"Stationery","variants":[["Plastic cover",0.50],["Khaki cover",0.50]]},
    {"name":"Flour","category":"Groceries","variants":[["Mega All Purpose",2.00],["Mega Self-raising",2.00],["Gloria Self-raising",2.00]]},
    {"name":"Mega Snax","category":"Snacks","variants":[["Small 100g",0.25],["Big 150g",0.50]]},
    {"name":"Spaghetti","category":"Groceries","variants":[["Bela 50g",0.50]]},
    {"name":"Sugar","category":"Groceries","variants":[["GoldStar",3.00],["Huletts",2.70],["Tapitapi",2.60]]},
    {"name":"Instant Cereal","category":"Breakfast","variants":[["Standard",2.00]]},
    {"name":"Things Chips","category":"Snacks","variants":[["Standard",0.50]]},
    {"name":"Cooking Oil 2 litres","category":"Groceries","variants":[["Zimgold",3.50],["Olivine",3.50],["Puredrop",3.50],["Golden Glow",3.30]]},
    {"name":"Cooking Oil","category":"Groceries","variants":[["Dlite 750ml",1.50],["Dlite 375ml",1.00]]},
    {"name":"Rabroy 500ml","category":"Groceries","variants":[["Standard",1.50]]},
    {"name":"Salad Cream 750ml","category":"Groceries","variants":[["Standard",3.00]]},
    {"name":"Karinga","category":"Groceries","variants":[["Standard",0.50]]},
    {"name":"Royco","category":"Groceries","variants":[["Beef",0.50],["Chicken",0.50]]},
    {"name":"Know Soup","category":"Groceries","variants":[["Standard",0.50]]},
    {"name":"Jam","category":"Groceries","variants":[["Sun Jam",1.50],["Marmalade Jam",1.75]]},
    {"name":"Fresh Milk","category":"Dairy","variants":[["1 litre Chimombe",1.00],["1 litre Dandairy",1.00],["250ml",1.00]]},
    {"name":"Chocolate Milk 250ml","category":"Dairy","variants":[["Standard",0.50]]},
    {"name":"Cremora","category":"Breakfast","variants":[["Sachet",1.75],["Box",3.50]]},
    {"name":"Ellis Brown","category":"Breakfast","variants":[["Sachet",1.75],["Box",3.50]]},
    {"name":"Tinned Fish","category":"Groceries","variants":[["Lucky Star",1.00]]},
    {"name":"Ricoffy","category":"Breakfast","variants":[["Small",1.50],["Big",3.00]]},
    {"name":"Everyday Powdered Milk","category":"Dairy","variants":[["Standard",3.50]]},
    {"name":"Steri Milk","category":"Dairy","variants":[["Standard",1.00]]},
    {"name":"Tinned Beef","category":"Groceries","variants":[["Bull Brand",2.00]]},
    {"name":"Milk-it","category":"Dairy","variants":[["Standard",0.50]]},
    {"name":"Chungs","category":"Snacks","variants":[["Small",0.50],["Big",1.00]]},
    {"name":"Smiley Chips","category":"Snacks","variants":[["Single",0.05],["3 pack",0.15],["5 pack",0.25],["10 pack",0.50],["Pack",1.00]]},
    {"name":"Eggs","category":"Dairy","variants":[["3 eggs",0.50],["6 eggs",1.00],["Crate",4.50]]},
    {"name":"Tissue","category":"Household","variants":[["Two ply single",0.50],["Two ply 2 pack",1.00],["18-roll pack",9.00]]},
    {"name":"Satiskin","category":"Personal Care","variants":[["2L Coconut",4.50],["2L Lavender",4.50],["2L Wild Rose",4.50],["2L Peach Blossom",4.50],["2L Luxurious",5.00],["1L",2.25]]},
    {"name":"Bath Soap","category":"Personal Care","variants":[["Geisha",1.00],["Lux",1.00],["Protex",1.00],["Detol",1.00],["Lifebuoy",1.00],["Hi-life",0.50],["Romance",0.60],["Jade",0.80]]},
    {"name":"MAQ Washing Powder","category":"Household","variants":[["2kg",5.00]]},
    {"name":"Aloha Washing Powder","category":"Household","variants":[["2kg",4.50],["1kg",2.50],["500g",1.25]]},
    {"name":"Boom Washing Powder","category":"Household","variants":[["2kg",4.50],["1kg",2.50],["500g",1.25]]},
    {"name":"Handy Andy","category":"Household","variants":[["Standard",2.00]]},
    {"name":"Cleancloud Body Wash","category":"Personal Care","variants":[["Standard",3.50]]},
    {"name":"Cool Splash Drink","category":"Beverages","variants":[["5L Raspberry",4.00],["5L Cream Soda",4.00],["5L Blackberry",4.00],["5L Orange",4.00]]},
    {"name":"Baseline Drink","category":"Beverages","variants":[["5L Raspberry",3.50],["5L Cream Soda",3.50],["5L Blackberry",3.50],["5L Orange",3.50]]},
    {"name":"Mazoe Drink","category":"Beverages","variants":[["2L Raspberry",3.00],["2L Cream Soda",3.00],["2L Peach",3.00],["2L Blackberry",3.50],["2L Orange Crush",4.00]]},
    {"name":"Kitchen Essentials","category":"Household","variants":[["Boom Paste",0.50],["Toast Leaf",0.25],["Aromat",1.00],["Toothbrush",0.50]]},
    {"name":"Cuettie","category":"Personal Care","variants":[["Small",1.00],["Medium",1.00],["Large",1.00],["Extra Large",1.00]]},
    {"name":"Softcare","category":"Personal Care","variants":[["Small pack",4.50],["Medium pack",4.50],["Large pack",4.50],["Extra Large pack",4.50],["Small packet",1.00],["Medium packet",1.00],["Large packet",1.00],["Extra Large packet",1.00]]},
    {"name":"Bread","category":"Bakery","variants":[["Baker's Inn loaf",1.00],["Unbranded loaf",0.50],["Unbranded 2 loaves",1.00]]},
    {"name":"Black Soil Mealie Meal","category":"Groceries","variants":[["5kg",3.00],["10kg",5.00]]},
    {"name":"Maputi","category":"Snacks","variants":[["Red package single",0.05],["Red package 5",0.25],["Red package 10",0.50],["Red package",1.00],["Blue package",1.00]]},
    {"name":"Matches","category":"Household","variants":[["Single box",0.05],["5 boxes",0.25],["Carton",0.50]]}
  ]'::jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(catalog) LOOP
    SELECT id INTO product_id FROM public.products WHERE lower(name) = lower(item->>'name') LIMIT 1;
    IF product_id IS NULL THEN
      INSERT INTO public.products (name, category, base_price, active)
      VALUES (item->>'name', item->>'category', ((item->'variants'->0->>1)::numeric), true)
      RETURNING id INTO product_id;
    ELSE
      UPDATE public.products SET category = COALESCE(category, item->>'category'), active = true WHERE id = product_id;
    END IF;
    FOR variant IN SELECT * FROM jsonb_array_elements(item->'variants') LOOP
      SELECT pv.id INTO variant_id FROM public.product_variants AS pv WHERE pv.product_id = product_id AND lower(pv.variant_name) = lower(variant->>0) LIMIT 1;
      IF variant_id IS NULL THEN
        INSERT INTO public.product_variants (product_id, variant_name, price)
        VALUES (product_id, variant->>0, (variant->>1)::numeric) RETURNING id INTO variant_id;
      ELSE
        UPDATE public.product_variants SET price = (variant->>1)::numeric WHERE id = variant_id;
      END IF;
      INSERT INTO public.stock (variant_id, quantity, low_stock_alert_level)
      VALUES (variant_id, 40, 10)
      ON CONFLICT (variant_id) DO UPDATE SET quantity = 40;
    END LOOP;
  END LOOP;
  UPDATE public.stock SET quantity = 40;
END $$;
