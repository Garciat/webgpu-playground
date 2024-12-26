export default ({ search }: Lume.Data, { url }: Lume.Helpers) => {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />

        <title>garciat: webgpu-playground</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <link rel="stylesheet" href={url("/css/index.css")} />
      </head>

      <body>
        <main>
          <header>
            <h1>
              garciat: webgpu-playground
            </h1>
          </header>
          <section>
            {search.pages("type=post").map((post) => (
              <article>
                <header>
                  <h2>{post.title}</h2>
                </header>
                <iframe src={post.url + "#timing=no"}></iframe>
                <footer>
                  <a href={post.url}>Open</a>
                </footer>
              </article>
            ))}
          </section>
        </main>
      </body>
    </html>
  );
};
