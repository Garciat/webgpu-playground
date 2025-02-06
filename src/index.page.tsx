export const title = "WebGPU Playground";

export const description =
  "A collection of graphics programming experiments using WebGPU.";

export default (data: Lume.Data, h: Lume.Helpers) => {
  const { search } = data;

  const posts = search.pages("type=post", "title=asc");

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />

        <title>{data.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <link rel="stylesheet" href={h.url("/css/index.css")} />
      </head>

      <body>
        <main>
          <header>
            <h1>
              {data.title}
            </h1>
            <p>{data.description}</p>
          </header>
          <section>
            {posts.map((post) => (
              <article>
                <header>
                  <h2>{post.title}</h2>
                </header>
                <iframe src={h.url(post.url) + "#timing=no"}></iframe>
                <footer>
                  <a href={h.url(post.url)}>Open</a>
                </footer>
              </article>
            ))}
          </section>
        </main>
      </body>
    </html>
  );
};
