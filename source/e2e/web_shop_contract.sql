-- Executed only in an isolated, rollback-only QA schema by web_shop_sql_e2e.py.
do $$
declare owner_id uuid; sale_user uuid:=gen_random_uuid(); buy_user uuid:=gen_random_uuid();
 p1 jsonb;p2 jsonb;vendor jsonb;customer jsonb;buydoc jsonb;saledoc jsonb;ret jsonb;edited jsonb;r jsonb;payload jsonb;v numeric;n bigint;oldn bigint;begin
 select id into owner_id from auth.users where raw_app_meta_data->>'web_admin'='true' limit 1;
 if owner_id is null then raise exception 'QA needs an existing owner identity; no real business record is touched.';end if;
 insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 (sale_user,'rollback-sales-'||sale_user||'@example.invalid','authenticated','authenticated','{"web_shop_staff":true}','{}',now(),now()),
 (buy_user,'rollback-buy-'||buy_user||'@example.invalid','authenticated','authenticated','{"web_shop_staff":true}','{}',now(),now());
 perform public.web_shop_api(owner_id,'staff_save',jsonb_build_object('user_id',sale_user,'name','فروش آزمایشی','department','sales','active',true,'permissions','{"sales.view":true,"sales.create":true,"catalog.view":true,"finance.view":true,"finance.create":true}'::jsonb));
 perform public.web_shop_api(owner_id,'staff_save',jsonb_build_object('user_id',buy_user,'name','خرید آزمایشی','department','purchasing','active',true,'permissions','{"purchases.view":true,"purchases.create":true,"inventory.view":true,"catalog.view":true}'::jsonb));
 vendor=public.web_shop_api(owner_id,'party_save','{"name":"تأمین‌کنندهٔ آزمایشی","supplier":true,"type":"company"}');
 customer=public.web_shop_api(owner_id,'party_save','{"name":"مشتری آزمایشی","customer":true,"type":"person"}');
 p1=public.web_shop_api(owner_id,'product_save','{"name":"چوب تست گلف","sku":"QA-RH-STIFF","category":"چوب‌ها","sale_price":300,"attributes":{"hand":"راست","flex":"Stiff","loft":"10.5"},"images":["/images/products/driver.jpg"]}');
 p2=public.web_shop_api(owner_id,'product_save','{"name":"کفش تست گلف","sku":"QA-SHOE-42","category":"کفش","sale_price":200,"attributes":{"size":"42"},"images":["/images/products/shoes.jpg"]}');
 payload=jsonb_build_object('client_id',gen_random_uuid(),'kind','purchase','date',web_shop.today(),'party_id',vendor->'id','reference','QA-BILL-001','freight',100,'paid',0,'post',true,'lines',jsonb_build_array(jsonb_build_object('product_id',p1->'id','qty',10,'price',200)));
 buydoc=public.web_shop_api(buy_user,'document_save',payload);
 if (buydoc->>'total')::numeric<>2100 then raise exception 'QA purchase total';end if;
 if (select qty from web_shop.inventory where product_id=(p1->>'id')::bigint)<>10 or (select value from web_shop.inventory where product_id=(p1->>'id')::bigint)<>2100 then raise exception 'QA landed inventory cost';end if;
 oldn=(select count(*) from web_shop.stock_moves);perform public.web_shop_api(buy_user,'document_save',payload);
 if (select count(*) from web_shop.stock_moves)<>oldn then raise exception 'QA duplicate request changed stock';end if;
 begin
  perform public.web_shop_api(buy_user,'document_save',jsonb_set(payload,'{freight}','200'));raise exception 'QA should reject changed reused id';
 exception when serialization_failure then null;end;
 payload=jsonb_build_object('client_id',gen_random_uuid(),'kind','sale','date',web_shop.today(),'party_id',customer->'id','paid',400,'post',true,'lines',jsonb_build_array(jsonb_build_object('product_id',p1->'id','qty',3,'price',300)));
 saledoc=public.web_shop_api(sale_user,'document_save',payload);
 if (saledoc->>'total')::numeric<>900 or (saledoc->>'remaining')::numeric<>500 then raise exception 'QA sale/partial payment';end if;
 if saledoc->'lines'->0 ? 'cost' then raise exception 'QA cost leaked to salesperson';end if;
 if (select qty from web_shop.inventory where product_id=(p1->>'id')::bigint)<>7 or (select value from web_shop.inventory where product_id=(p1->>'id')::bigint)<>1470 then raise exception 'QA sale inventory/cost';end if;
 r=public.web_shop_api(sale_user,'bootstrap');
 if (r->'products'->0 ? 'average_cost') or exists(select 1 from jsonb_array_elements(r->'parties') x where x->>'supplier'='true') then raise exception 'QA private fields leaked';end if;
 begin perform public.web_shop_api(sale_user,'document_get',jsonb_build_object('id',buydoc->'id'));raise exception 'QA purchase access should fail';exception when insufficient_privilege then null;end;
 begin perform public.web_shop_api(sale_user,'report','{}');raise exception 'QA report access should fail';exception when insufficient_privilege then null;end;
 begin perform public.web_shop_api(sale_user,'staff_save',jsonb_build_object('user_id',sale_user));raise exception 'QA permission escalation';exception when insufficient_privilege then null;end;
 begin perform public.web_shop_api(sale_user,'document_save',payload||jsonb_build_object('id',saledoc->'id','version',saledoc->'version'));raise exception 'QA create-only edited invoice';exception when insufficient_privilege then null;end;
 oldn=(select count(*) from web_shop.documents);
 begin
  perform public.web_shop_api(sale_user,'document_save',jsonb_set(jsonb_set(payload,'{client_id}',to_jsonb(gen_random_uuid())),'{lines,0,qty}','99'));raise exception 'QA should reject negative stock';
 exception when raise_exception then if sqlerrm not like 'موجودی%' then raise;end if;end;
 if (select count(*) from web_shop.documents)<>oldn or (select qty from web_shop.inventory where product_id=(p1->>'id')::bigint)<>7 then raise exception 'QA partial failure leaked mutations';end if;
 -- Later purchase alters average, but returning a sale restores its original captured cost.
 perform public.web_shop_api(owner_id,'document_save',jsonb_build_object('client_id',gen_random_uuid(),'kind','purchase','date',web_shop.today(),'party_id',vendor->'id','post',true,'lines',jsonb_build_array(jsonb_build_object('product_id',p1->'id','qty',3,'price',500))));
 payload=jsonb_build_object('client_id',gen_random_uuid(),'kind','sale_return','date',web_shop.today(),'party_id',customer->'id','original_id',saledoc->'id','post',true,'lines',jsonb_build_array(jsonb_build_object('product_id',p1->'id','qty',1,'price',999999)));
 begin perform public.web_shop_api(sale_user,'document_save',payload);raise exception 'QA return permission should fail';exception when insufficient_privilege then null;end;
 ret=public.web_shop_api(owner_id,'document_save',payload);
 if (ret->>'total')::numeric<>300 then raise exception 'QA return must use original price';end if;
 if (select value from web_shop.inventory where product_id=(p1->>'id')::bigint)<>3180 then raise exception 'QA original sales cost restoration';end if;
 r=public.web_shop_api(owner_id,'document_get',jsonb_build_object('id',saledoc->'id'));if (r->>'remaining')::numeric<>200 then raise exception 'QA returns must reduce invoice balance';end if;
 perform public.web_shop_api(sale_user,'payment_post',jsonb_build_object('client_id',gen_random_uuid(),'kind','receipt','date',web_shop.today(),'document_id',saledoc->'id','amount',200,'account','1000'));
 r=public.web_shop_api(owner_id,'document_get',jsonb_build_object('id',saledoc->'id'));if (r->>'remaining')::numeric<>0 then raise exception 'QA settlement';end if;
 begin perform public.web_shop_api(sale_user,'payment_post',jsonb_build_object('client_id',gen_random_uuid(),'kind','receipt','document_id',saledoc->'id','amount',1));raise exception 'QA overpayment should fail';exception when raise_exception then if sqlerrm not like 'مبلغ%' then raise;end if;end;
 -- Editable posted invoice with no downstream use: reverse + revised posting, never erase history.
 buydoc=public.web_shop_api(owner_id,'document_save',jsonb_build_object('client_id',gen_random_uuid(),'kind','purchase','date',web_shop.today(),'party_id',vendor->'id','post',true,'lines',jsonb_build_array(jsonb_build_object('product_id',p2->'id','qty',10,'price',100))));
 edited=public.web_shop_api(owner_id,'document_save',jsonb_build_object('id',buydoc->'id','version',buydoc->'version','kind','purchase','date',web_shop.today(),'party_id',vendor->'id','reason','اصلاح تعداد واقعی تحویل','post',true,'lines',jsonb_build_array(jsonb_build_object('product_id',p2->'id','qty',12,'price',100))));
 if (edited->>'revision')::integer<>2 or (select qty from web_shop.inventory where product_id=(p2->>'id')::bigint)<>12 then raise exception 'QA revision stock';end if;
 if not exists(select 1 from web_shop.journals where reversal_of is not null and document_id=(edited->>'id')::bigint) then raise exception 'QA revision audit missing';end if;
 perform public.web_shop_api(owner_id,'document_void',jsonb_build_object('id',edited->'id','reason','ابطال ثبت آزمایشی اشتباه'));
 if (select qty from web_shop.inventory where product_id=(p2->>'id')::bigint)<>0 then raise exception 'QA void stock';end if;
 -- Reports and privacy-facing endpoints must execute, not just compile.
 perform public.web_shop_api(owner_id,'inventory','{}');perform public.web_shop_api(owner_id,'documents','{"section":"purchases"}');
 perform public.web_shop_api(owner_id,'payments','{}');perform public.web_shop_api(owner_id,'party_statement',jsonb_build_object('id',customer->'id'));
 perform public.web_shop_api(owner_id,'dashboard','{}');perform public.web_shop_api(owner_id,'staff','{}');perform public.web_shop_api(owner_id,'audit','{}');
 perform public.web_shop_api(owner_id,'payment_post',jsonb_build_object('client_id',gen_random_uuid(),'kind','capital','amount',1000,'account','1010'));
 perform public.web_shop_api(owner_id,'payment_post',jsonb_build_object('client_id',gen_random_uuid(),'kind','expense','amount',150,'account','1010','note','هزینه آزمایشی'));
 perform public.web_shop_api(owner_id,'payment_post',jsonb_build_object('client_id',gen_random_uuid(),'kind','transfer','amount',100,'account','1010','note','انتقال آزمایشی'));
 r=public.web_shop_api(owner_id,'payment_post',jsonb_build_object('client_id',gen_random_uuid(),'kind','opening_receivable','amount',500,'party_id',customer->'id','note','مانده قبلی'));
 perform public.web_shop_api(owner_id,'payment_void',jsonb_build_object('id',r->'id','reason','ابطال افتتاحیه آزمایشی'));
 perform public.web_shop_api(owner_id,'payment_post',jsonb_build_object('client_id',gen_random_uuid(),'kind','opening_payable','amount',200,'party_id',vendor->'id','note','مانده قبلی'));
 perform public.web_shop_api(owner_id,'journal_get',jsonb_build_object('id',(select max(id) from web_shop.journals)));
 perform public.web_shop_api(owner_id,'ledger','{"account":"1100"}');
 -- Product/category changes must not rewrite historical invoice labels.
 p1=public.web_shop_api(owner_id,'bootstrap')->'products'->0;
 select to_jsonb(p) into p1 from web_shop.products p where p.sku='QA-RH-STIFF';
 perform public.web_shop_api(owner_id,'product_save',p1||jsonb_build_object('name','عنوان جدید کالای تست'));
 r=public.web_shop_api(owner_id,'document_get',jsonb_build_object('id',saledoc->'id'));
 if r->'lines'->0->>'name'<>'چوب تست گلف' then raise exception 'QA historical invoice label changed';end if;
 perform public.web_shop_api(owner_id,'category_rename','{"from":"چوب‌ها","to":"چوب‌های گلف"}');

 r=public.web_shop_api(owner_id,'report','{}');
 if exists(select 1 from web_shop.journal_lines group by journal_id having sum(debit-credit)<>0) then raise exception 'QA unbalanced journal';end if;
 select sum(debit-credit) into v from web_shop.journal_lines where account='1100';
 if v<>(select sum(value) from web_shop.inventory) then raise exception 'QA inventory and GL do not reconcile';end if;
 if has_table_privilege('anon','web_shop.documents','select') or has_table_privilege('authenticated','web_shop.documents','select') then raise exception 'QA private table grants';end if;
 if has_function_privilege('anon','public.web_shop_api(uuid,text,jsonb)','execute') then raise exception 'QA private RPC exposed';end if;
 perform public.web_shop_api(owner_id,'settings_save',jsonb_build_object('closed_through',web_shop.today()));
 begin perform public.web_shop_api(owner_id,'payment_post',jsonb_build_object('client_id',gen_random_uuid(),'kind','expense','amount',1));raise exception 'QA closed period should reject';exception when raise_exception then if sqlerrm not like 'این دوره%' then raise;end if;end;
 perform public.web_shop_api(owner_id,'staff_save',jsonb_build_object('user_id',sale_user,'name','فروش آزمایشی','department','sales','active',false,'permissions','{}'::jsonb));
 begin perform public.web_shop_api(sale_user,'bootstrap','{}');raise exception 'QA disabled employee accessed';exception when insufficient_privilege then null;end;
end $$;
select 'PASS: purchasing, landed cost, stock, sale, partial payments, returns, immutable correction, accounting balance, least privilege and period locks. All synthetic and rollback-only.' as result;
