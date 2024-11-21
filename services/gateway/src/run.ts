import { CircuitBreaker } from '@rsoi-lab2/library';
import { CarsClient, PaymentsClient, RentalsClient } from './client';
import { CarsLogic, PaymentsLogic, RentalsLogic, RentalRetrievalLogic, RentalDereferenceUidsLogic, RentalProcessLogic, CarsRetrievalLogic } from './logic';
import { CBCarsRetrievalLogic } from './logic/cars-retrieval-with-circuit-breaker/class';
import { GatewayServer } from './server';
import { CBRentalRetrievalLogic } from './logic/rental-retrieval-with-circuit-breaker';
import { RQRentalProcessLogic } from './logic/rental-process-with-queue';
import { Queue } from './logic/rental-process-with-queue';

const 
    port = parseInt(process.env.PORT ?? '8000', 10),
    carsApiUrl = process.env.CARS_API_URL!,
    paymentApiUrl = process.env.PAYMENT_API_URL!,
    rentalApiUrl = process.env.RENTAL_API_URL!,
    redisUrl = process.env.REDIS_CONN_STRING!,
    noCircutBreakers = Boolean(process.env.NO_CIRCUIT_BREAKERS),
    noQueues = Boolean(process.env.NO_QUEUES);

const 
    carsClient = new CarsClient(carsApiUrl),
    paymentsClient = new PaymentsClient(paymentApiUrl),
    rentalsClient = new RentalsClient(rentalApiUrl),
    carsLogic = new CarsLogic(carsClient),
    paymentsLogic = new PaymentsLogic(paymentsClient),
    rentalsLogic = new RentalsLogic(rentalsClient),
    rentalDereferenceLogic = new RentalDereferenceUidsLogic(carsLogic, paymentsLogic);

const carsRetrievalLogic = noCircutBreakers ? 
    new CarsRetrievalLogic(carsLogic) : 
    new CBCarsRetrievalLogic(new CircuitBreaker(), carsLogic);

const rentalRetrievalLogic = noCircutBreakers ? 
    new RentalRetrievalLogic(rentalsLogic, rentalDereferenceLogic) : 
    new CBRentalRetrievalLogic(new CircuitBreaker(), rentalsLogic, rentalDereferenceLogic);

const queue = noQueues ? null : new Queue('rsoi-lab3', {
    redis: {
        url: redisUrl
    },
});

const rentalProcessLogic = noQueues ? 
    new RentalProcessLogic(carsLogic, paymentsLogic, rentalsLogic, rentalDereferenceLogic) : 
    new RQRentalProcessLogic(queue, carsLogic, paymentsLogic, rentalsLogic, rentalDereferenceLogic);

const server = new GatewayServer(
    carsRetrievalLogic, 
    rentalRetrievalLogic, 
    rentalProcessLogic,
    port
);

if (noQueues) {
    server.start();
} else {
    queue.on('ready', () => server.start());
}
