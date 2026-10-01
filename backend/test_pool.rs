use sqlx::postgres::PgPoolOptions;

fn main() {
    let _options = PgPoolOptions::new()
        .before_acquire(|_conn, _meta| {
            Box::pin(async move {
                Ok(())
            })
        })
        .after_release(|_conn, _meta| {
            Box::pin(async move {
                Ok(())
            })
        });
}
