$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$articles = Get-Content -Raw (Join-Path $root 'articles.json') | ConvertFrom-Json

function Encode([string]$Value) { [System.Net.WebUtility]::HtmlEncode($Value) }
function Render-Block($Block) {
  if ($Block.type -eq 'heading') { return "<h2>$(Encode $Block.text)</h2>" }
  if ($Block.type -eq 'quote') { return "<blockquote><p>$(Encode $Block.text)</p><cite>$(Encode $Block.source)</cite></blockquote>" }
  if ($Block.type -eq 'list') {
    $items = ($Block.items | ForEach-Object { "<li>$(Encode $_)</li>" }) -join ''
    return "<ul>$items</ul>"
  }
  return "<p>$(Encode $Block.text)</p>"
}

foreach ($article in $articles) {
  $directory = Join-Path $root "artikel/$($article.slug)"
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $canonical = "https://sedekahqr.com/artikel/$($article.slug)/"
  $image = "https://sedekahqr.com/$($article.cover_image)"
  $body = ($article.content | ForEach-Object { Render-Block $_ }) -join "`n"
  $toc = ($article.content | Where-Object type -eq 'heading' | ForEach-Object { "<li>$(Encode $_.text)</li>" }) -join ''
  $sources = ($article.sources | ForEach-Object { "<li><a href=`"$(Encode $_.url)`" rel=`"noopener noreferrer`">$(Encode $_.label)</a></li>" }) -join ''
  $schema = @{ '@context'='https://schema.org'; '@type'='Article'; headline=$article.title; description=$article.excerpt; image=@($image); datePublished=$article.published_at; dateModified=$article.published_at; inLanguage='ms-MY'; mainEntityOfPage=@{'@type'='WebPage'; '@id'=$canonical}; author=@{'@type'='Organization'; name=$article.author}; publisher=@{'@type'='Organization'; name='SedekahQR'; logo=@{'@type'='ImageObject'; url='https://sedekahqr.com/assets/sedekahqr-icon-512.png'}}; articleSection=$article.category } | ConvertTo-Json -Compress -Depth 5
  $html = @"
<!DOCTYPE html>
<html lang="ms"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>$(Encode $article.title) - SedekahQR</title><meta name="description" content="$(Encode $article.excerpt)">
<link rel="canonical" href="$canonical"><meta property="og:type" content="article"><meta property="og:site_name" content="SedekahQR"><meta property="og:title" content="$(Encode $article.title) - SedekahQR"><meta property="og:description" content="$(Encode $article.excerpt)"><meta property="og:url" content="$canonical"><meta property="og:image" content="$image"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">$schema</script><link rel="stylesheet" href="../../styles.css"><link rel="stylesheet" href="../../blog.css"></head>
<body class="directory-body blog-body"><header class="directory-header"><div class="directory-container header-inner"><a class="directory-brand" href="/" aria-label="SedekahQR"><span class="brand-mark"><img src="../../assets/sedekahqr-logo.svg" alt=""></span><span class="brand-wordmark"><strong><span>Sedekah</span><b>QR</b></strong></span></a><nav class="directory-nav"><a href="/">Homepage</a><a href="/blog.html">Artikel</a><a href="/quran.html">Al-Quran</a></nav></div></header>
<main><article class="article-page"><header class="article-header"><div class="article-reading-column"><nav class="article-breadcrumb"><a href="/blog.html">Artikel</a><span>/</span><span>$(Encode $article.category)</span></nav><h1>$(Encode $article.title)</h1><p class="article-excerpt">$(Encode $article.excerpt)</p><div class="article-meta"><span>$(Encode $article.author)</span><time datetime="$($article.published_at)">$($article.published_at.ToString('yyyy-MM-dd'))</time><span>$($article.reading_minutes) minit bacaan</span></div></div></header><figure class="article-cover-wrap"><img src="../../$(Encode $article.cover_image)" alt="Imej muka hadapan untuk $(Encode $article.title)" width="1536" height="1024"></figure><div class="article-reading-column"><nav class="article-toc"><p class="blog-eyebrow">DALAM ARTIKEL INI</p><h2>Panduan ringkas</h2><ol>$toc</ol></nav><div class="article-content">$body</div><aside class="article-sources"><p class="blog-eyebrow">SEMAK RUJUKAN</p><h2>Sumber utama</h2><ul>$sources</ul><p>Artikel ini ialah bahan pendidikan umum dan bukan fatwa atau nasihat hukum khusus.</p></aside></div></article></main>
<footer class="directory-footer"><div class="directory-container"><div class="footer-bottom"><p>&copy; 2026 SedekahQR.</p><p><a href="/blog.html">Artikel</a> &middot; <a href="/privacy.html">Notis Privasi</a></p></div></div></footer></body></html>
"@
  Set-Content -LiteralPath (Join-Path $directory 'index.html') -Value $html -Encoding utf8
}
