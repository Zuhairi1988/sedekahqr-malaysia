update public.islamic_articles
set cover_image = case slug
  when 'syukur-mengubah-cara-melihat-nikmat' then 'assets/article-syukur-nikmat.jpg'
  when 'sabar-dan-solat-ketika-berdepan-kesukaran' then 'assets/article-sabar-solat.jpg'
  when 'berbuat-baik-kepada-ibu-bapa-dalam-kehidupan-harian' then 'assets/article-berbuat-baik-ibu-bapa.jpg'
  when 'menjaga-lisan-di-rumah-tempat-kerja-dan-media-sosial' then 'assets/article-menjaga-lisan.jpg'
  when 'amalan-kecil-yang-konsisten' then 'assets/article-amalan-konsisten.jpg'
  when 'adab-bersedekah-menjaga-niat-dan-maruah' then 'assets/article-adab-sedekah.jpg'
  when 'cara-solat-taubat-panduan-lengkap-niat-dan-doa-taubat-nasuha-978940' then 'assets/article-cara-solat-taubat.jpg'
  else cover_image
end
where slug in (
  'syukur-mengubah-cara-melihat-nikmat',
  'sabar-dan-solat-ketika-berdepan-kesukaran',
  'berbuat-baik-kepada-ibu-bapa-dalam-kehidupan-harian',
  'menjaga-lisan-di-rumah-tempat-kerja-dan-media-sosial',
  'amalan-kecil-yang-konsisten',
  'adab-bersedekah-menjaga-niat-dan-maruah',
  'cara-solat-taubat-panduan-lengkap-niat-dan-doa-taubat-nasuha-978940'
);
