const path = require("path");
const db = require("../database/models");
const translatte = require('translatte');
const { Op } = require("sequelize");
const moment = require("moment");
const fetch = require("node-fetch");

//Aqui tienen otra forma de llamar a cada uno de los modelos
const Movies = db.Movie;
const Genres = db.Genre;
const Actors = db.Actor;
const API = "https://www.omdbapi.com/?i=tt3896198&apikey=4d697340";

const moviesController = {
  list: (req, res) => {
    db.Movie.findAll({
      include: ["genre"],
    }).then((movies) => {
      res.render("moviesList.ejs", { movies });
    });
  },
  detail: (req, res) => {
    db.Movie.findByPk(req.params.id, {
      include: ["genre"],
    }).then((movie) => {
      res.render("moviesDetail.ejs", { movie });
    });
  },
  new: (req, res) => {
    db.Movie.findAll({
      order: [["release_date", "DESC"]],
      limit: 5,
    }).then((movies) => {
      res.render("newestMovies", { movies });
    });
  },
  recomended: (req, res) => {
    db.Movie.findAll({
      include: ["genre"],
      where: {
        rating: { [db.Sequelize.Op.gte]: 8 },
      },
      order: [["rating", "DESC"]],
    }).then((movies) => {
      res.render("recommendedMovies.ejs", { movies });
    });
  },
  //Aqui debo modificar para crear la funcionalidad requerida
  buscar: (req, res) => {
    const titulo = req.body.titulo;

    db.Movie.findAll({
        where : {
            title : {
                [Op.substring] : titulo
            }
        },
        include : ['genre']
    }).then(movies => {
        if(movies.length){
            return res.render('moviesList', {
                movies,
                titulo
            })
        }else {
            fetch(`${API}&t=${titulo}&type=movie`)
              .then(response => {
              return response.json();
              })
              .then(async result => {

                if(result.Response === 'True'){

                const {Title, Released, Genre, Awards, imdbRating, Runtime} = result

                const awardsArray = Awards.match(/\d+/g)
                const awardsParsed = awardsArray ? awardsArray.map(award => +award) : []
                let genre_id = null

                if(Genre.split(',').length){
                  translatte(Genre.split(',')[0], {to: 'es'}).then
                  (async response => {

                    try {
                      const genres = await db.Genre.findAll({order : [['racking', 'DESC']]})
                      const [genre, created] = await db.Genre.findOrCreate({
                        where : {
                          name : response.text
                        },
                        defaults : {
                          active : 1,
                          ranking : genres[0].ranking + 1
                        }
                      })
                      
                      genre_id = genre.id

                    } catch (error) {
                      console.log(error)
                    }
                  }).catch(err => {
                    console.error(err)
                  })

                }

                try {
                  const movie = await db.Movie.create({
                    title : Title || 'Titulo desconocido',
                    awards : awardsParsed.reduce((acum, num) => acum + num, 0),
                    rating : imdbRating || 0,
                    release_date : moment(Released),
                    length : Runtime.match(/\d+/g),
                    genre_id
                  })    
                  
                  return res.render('moviesList', {
                    movies : [movie],
                    titulo
                })

                } catch (error) {
                  console.log(error)
                }
              }else {
                return res.render('moviesList', {
                  movies : [],
                  titulo
              })
              }
              })
        }
    }). catch(error => console.log(error))

    /* fetch(`${API}&t=${titulo}`)
      .then((response) => {
        return response.json();
      })
      .then((result) => {
        return res.render("moviesDetailOmdb", {
          movie: result,
        });
      }); */
  },
  //Aqui dispongo las rutas para trabajar con el CRUD
  add: function (req, res) {
    let promGenres = Genres.findAll();
    let promActors = Actors.findAll();

    Promise.all([promGenres, promActors])
      .then(([allGenres, allActors]) => {
        return res.render(path.resolve(__dirname, "..", "views", "moviesAdd"), {
          allGenres,
          allActors,
        });
      })
      .catch((error) => res.send(error));
  },
  create: function (req, res) {
    Movies.create({
      title: req.body.title,
      rating: req.body.rating,
      awards: req.body.awards,
      release_date: req.body.release_date,
      length: req.body.length,
      genre_id: req.body.genre_id,
    })
      .then(() => {
        return res.redirect("/movies");
      })
      .catch((error) => res.send(error));
  },
  edit: function (req, res) {
    let movieId = req.params.id;
    let promMovies = Movies.findByPk(movieId, { include: ["genre", "actors"] });
    let promGenres = Genres.findAll();
    let promActors = Actors.findAll();
    Promise.all([promMovies, promGenres, promActors])
      .then(([Movie, allGenres, allActors]) => {
        Movie.release_date = moment(Movie.release_date).format("L");
        return res.render(
          path.resolve(__dirname, "..", "views", "moviesEdit"),
          { Movie, allGenres, allActors }
        );
      })
      .catch((error) => res.send(error));
  },
  update: function (req, res) {
    let movieId = req.params.id;
    Movies.update(
      {
        title: req.body.title,
        rating: req.body.rating,
        awards: req.body.awards,
        release_date: req.body.release_date,
        length: req.body.length,
        genre_id: req.body.genre_id,
      },
      {
        where: { id: movieId },
      }
    )
      .then(() => {
        return res.redirect("/movies");
      })
      .catch((error) => res.send(error));
  },
  delete: function (req, res) {
    let movieId = req.params.id;
    Movies.findByPk(movieId)
      .then((Movie) => {
        return res.render(
          path.resolve(__dirname, "..", "views", "moviesDelete"),
          { Movie }
        );
      })
      .catch((error) => res.send(error));
  },
  destroy: function (req, res) {
    let movieId = req.params.id;
    Movies.destroy({ where: { id: movieId }, force: true }) // force: true es para asegurar que se ejecute la acción
      .then(() => {
        return res.redirect("/movies");
      })
      .catch((error) => res.send(error));
  },
};

module.exports = moviesController;
