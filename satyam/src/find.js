/* eslint-disable camelcase */
'use strict';

const httpStatus = require('http-status');
const APIError = require('../utils/APIError');
const Recruiter = require('../models/recruiter.model');
const Applicant = require('../models/applicant.model');
const Job = require('../models/job.model');
const RedisClient = require('../services/redis');

exports.getAll = async (req, res, next) => {
  try {
    const response = { payLoad: {} };
    const job = await Job.find().exec();
    const recruiter = await Recruiter.find().exec();
    const applicant = await Applicant.find().exec();
    response.payLoad = { job, recruiter, applicant };
    res.status(httpStatus.OK).send(response);
  } catch (error) {
    next(error);
  }
};

exports.getJobs = async (req, res, next) => {
  try {
    const response = { payLoad: {} };
    const job = await Job.find().exec();
    response.payLoad = { job };
    res.status(httpStatus.OK).send(response);
  } catch (error) {
    next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const response = { payLoad: {} };
    const recruiter = await Recruiter.find().exec();
    const applicant = await Applicant.find().exec();
    response.payLoad = { recruiter, applicant };
    res.status(httpStatus.OK).send(response);
  } catch (error) {
    next(error);
  }
};

exports.getFilteredJobs = async (req, res, next) => {
  try {
    const page = req.body.page ? req.body.page : 1;
    const response = { payLoad: [] };
    const criterion = req.body.criterion ? req.body.criterion : ' ';
    let lat = null;
    let long = null;

    if (req.body.coordinates) {
      lat = req.body.coordinates.latitude ? req.body.coordinates.latitude : null;
      long = req.body.coordinates.longitude ? req.body.coordinates.longitude : null;
    }

    const search_words = criterion.split(' ');

    for (let index = 0; index < search_words.length; index++) {
      const query = {
        $or: [
          { title: { $regex: search_words[index], $options: 'i' } },
          { company: { $regex: search_words[index], $options: 'i' } },
          { skills: { $regex: search_words[index], $options: 'i' } },
        ],
      };

      let result = await Job.find(query).exec();
      result = result.filter((job) => distance(lat, long, job.address.coordinates.latitude, job.address.coordinates.longitude) < 50);
      response.payLoad = response.payLoad.concat(result);
    }

    const key = `${criterion.split(' ').join('_')}_${lat}_${long}`;
    RedisClient.set(key, JSON.stringify(response.payLoad));
    response.payLoad = paginate(response.payLoad, page);
    res.status(httpStatus.OK).send(response);
  } catch (error) {
    next(error);
  }
};

exports.getFilteredUsers = async (req, res, next) => {
  try {
    if (!req.body.name) {
      throw new APIError('Invalid input', httpStatus.BAD_REQUEST);
    }

    const response = { payLoad: [] };
    const recruiter = await Recruiter.find().exec();
    const applicant = await Applicant.find().exec();
    const name = req.body.name.toLowerCase();

    for (let index = 0; index < recruiter.length; index++) {
      const element = recruiter[index];
      const fullName = `${element.name.first} ${element.name.last}`;

      if (fullName.toLowerCase().includes(name)) {
        response.payLoad.push(element);
      }
    }

    for (let index = 0; index < applicant.length; index++) {
      const element = applicant[index];
      const fullName = `${element.name.first} ${element.name.last}`;

      if (fullName.toLowerCase().includes(name)) {
        response.payLoad.push(element);
      }
    }

    res.status(httpStatus.OK);

    if (response.payLoad.length > 15) {
      response.payLoad = response.payLoad.slice(0, 14);
    }

    res.send(response);
  } catch (error) {
    next(error);
  }
};

const distance = (lat1, lon1, lat2, lon2) => {
  const radlat1 = Math.PI * lat1 / 180;
  const radlat2 = Math.PI * lat2 / 180;
  const theta = lon1 - lon2;
  const radtheta = Math.PI * theta / 180;
  let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);

  if (dist > 1) {
    dist = 1;
  }

  dist = Math.acos(dist);
  dist = dist * 180 / Math.PI;
  dist = dist * 60 * 1.1515;

  return dist.toPrecision(2);
};

const paginate = (array, pageNumber) => {
  --pageNumber;
  return array.slice(pageNumber * 10, (pageNumber + 1) * 10);
};