BlogPost"use strict";

const chai = require("chai");
const chaiHttp = require("chai-http");
const faker = require("faker");
const mongoose = require("mongoose");

// make the expect syntax available
const expect = chai.expect;

const { BlogPost } = require("../models");
const { app, runServer, closeServer } = require("../server");
const { TEST_DATABASE_URL } = require("../config");

chai.use(chaiHttp);

// put randomish test documents in db:
// use the Faker library to automatically
// generate placeholder values for author, title, content
// and then we insert that data into mongo
function seedBlogData() {
  console.info("seeding blog data");
  const seedData = [];

  for (let i = 1; i <= 10; i++) {
    seedData.push(generateBlogData());
  }
  // this will return a promise
  return BlogPost.insertMany(seedData);
}

function generateAuthor() {
  const firstName = faker();
  const lastName = faker();
  return { firstName: firstName, lastName: lastName };
}
// used to generate data to put in db
function generateBoroughName() {
  const boroughs = ["Manhattan", "Queens", "Brooklyn", "Bronx", "Staten Island"];
  return boroughs[Math.floor(Math.random() * boroughs.length)];
}

// used to generate data to put in db
function generateCuisineType() {
  const cuisines = ["Italian", "Thai", "Colombian"];
  return cuisines[Math.floor(Math.random() * cuisines.length)];
}

// generate an object represnting a blog.
// can be used to generate seed data for db
// or request.body data
function generateBlogData() {
  return {
    title: faker(), // ???
    author: generateAuthor(),
    content: faker() // ???
    // name: faker.company.companyName()
  };
}

// this function deletes the entire database.
// we'll call it in an `afterEach` block below
// to ensure data from one test does not stick
// around for next one
function tearDownDb() {
  console.warn("Deleting database");
  return mongoose.connection.dropDatabase();
}

describe("Blog Posts API resource", function() {
  // hook functions return a promise
  // (otherwise we'd need to call a `done` callback). `runServer`,
  // `seedBlogData` and `tearDownDb` each return a promise,
  // so we return the value returned by these function calls.
  before(function() {
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return seedBlogData();
  });

  afterEach(function() {
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  });

  // nested `describe` blocks allow clearer, more discrete tests that focus
  // on proving something small
  describe("GET endpoint", function() {
    it("should return all existing blog posts", function() {
      // strategy:
      //    1. get back all blog posts returned by by GET request to `/posts`
      //    2. prove res has right status, data type
      //    3. prove the number of blog posts we got back is equal to number
      //       in db.
      //
      // need to have access to mutate and access `res` across
      // `.then()` calls below, so declare it here so can modify in place
      let res;
      return chai
        .request(app)
        .get("/posts")
        .then(function(_res) {
          // so subsequent .then blocks can access response object
          res = _res;
          expect(res).to.have.status(200);
          // otherwise our db seeding didn't work
          expect(res.body.posts).to.have.length.of.at.least(1);
          return BlogPost.count();
        })
        .then(function(count) {
          expect(res.body.posts).to.have.length.of(count);
        });
    });

    it("should return blog posts with right fields", function() {
      // Strategy: Get back all blog posts, and ensure they have expected keys

      let resBlogPost;
      return chai
        .request(app)
        .get("/posts")
        .then(function(res) {
          expect(res).to.have.status(200);
          expect(res).to.be.json;
          expect(res.body.posts).to.be.a("array");
          expect(res.body.posts).to.have.length.of.at.least(1);

          res.body.posts.forEach(function(post) {
            expect(post).to.be.a("object");
            expect(post).to.include.keys("id", "name", "cuisine", "borough", "grade", "address");
          });
          resBlogPost = res.body.posts[0];
          return BlogPost.findById(resBlogPost.id);
        })
        .then(function(post) {
          expect(resBlogPost.id).to.equal(post.id);
          expect(resBlogPost.title).to.equal(post.title);
          expect(resBlogPost.authorName).to.equal(post.authorName);
          expect(resBlogPost.content).to.equal(post.content);
          expect(resBlogPost.authorName).to.contain(post.author.lastName);
        });
    });
  });

  describe("POST endpoint", function() {
    // strategy: make a POST request with data,
    // then prove that the blog post we get back has
    // right keys, and that `id` is there (which means
    // the data was inserted into db)
    it("should add a new blog post", function() {
      const newBlogPost = generateBlogData();
      let mostRecentGrade;

      return chai
        .request(app)
        .post("/posts")
        .send(newBlogPost)
        .then(function(res) {
          expect(res).to.have.status(201);
          expect(res).to.be.json;
          expect(res.body).to.be.a("object");
          expect(res.body).to.include.keys("id", "name", "cuisine", "borough", "grade", "address");
          expect(res.body.name).to.equal(newBlogPost.name);
          // cause Mongo should have created id on insertion
          expect(res.body.id).to.not.be.null;
          expect(res.body.author).to.equal(newBlogPost.author);
          expect(res.body.content).to.equal(newBlogPost.content);

          mostRecentGrade = newpost.grades.sort((a, b) => b.date - a.date)[0].grade;

          expect(res.body.grade).to.equal(mostRecentGrade);
          return BlogPost.findById(res.body.id);
        })
        .then(function(post) {
          expect(post.title).to.equal(newBlogPost.title);
          expect(post.author).to.equal(newBlogPost.author);
          expect(post.content).to.equal(newBlogPost.content);
        });
    });
  });

  describe("PUT endpoint", function() {
    // strategy:
    //  1. Get an existing blog post from db
    //  2. Make a PUT request to update that blog post
    //  3. Prove blog post returned by request contains data we sent
    //  4. Prove blog post in db is correctly updated
    it("should update fields you send over", function() {
      const updateData = {
        name: "fofofofofofofof",
        cuisine: "futuristic fusion"
      };

      return BlogPost.findOne()
        .then(function(post) {
          updateData.id = post.id;

          // make request then inspect it to make sure it reflects
          // data we sent
          return chai
            .request(app)
            .put(`/posts/${post.id}`)
            .send(updateData);
        })
        .then(function(res) {
          expect(res).to.have.status(204);

          return BlogPost.findById(updateData.id);
        })
        .then(function(post) {
          expect(post.name).to.equal(updateData.name);
          expect(post.cuisine).to.equal(updateData.cuisine);
        });
    });
  });

  describe("DELETE endpoint", function() {
    // strategy:
    //  1. get a blog post
    //  2. make a DELETE request for that blog post's id
    //  3. assert that response has right status code
    //  4. prove that blog post with the id doesn't exist in db anymore
    it("should delete a blog post by id", function() {
      let post;

      return BlogPost.findOne()
        .then(function(_post) {
          post = _post;
          return chai.request(app).delete(`/posts/${post.id}`);
        })
        .then(function(res) {
          expect(res).to.have.status(204);
          return BlogPost.findById(post.id);
        })
        .then(function(_post) {
          expect(_post).to.be.null;
        });
    });
  });
});
