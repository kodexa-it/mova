-- Se ejecuta solo la primera vez que se crea el volumen de PostgreSQL.
-- La base "mova" la crea la imagen; acá se agrega la base de tests.
CREATE DATABASE mova_test OWNER mova;
